import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { LockMethod } from '../types';

const LOCAL_CREDENTIAL_KEY = 'screen_guard.local_credential.v1';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type LocalCredentialRecord = {
  version: 1;
  method: LockMethod;
  salt: string;
  verifier: string;
  createdAt: string;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function valuesMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function createVerifier(method: LockMethod, credential: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `screen-guard:v1:${method}:${salt}:${credential}`,
  );
}

async function readRecord(): Promise<LocalCredentialRecord | null> {
  const stored = await SecureStore.getItemAsync(LOCAL_CREDENTIAL_KEY, secureStoreOptions);
  if (!stored) return null;

  const parsed = JSON.parse(stored) as Partial<LocalCredentialRecord>;
  if (parsed.version !== 1 || !parsed.method || !parsed.salt || !parsed.verifier) {
    throw new Error('Stored lock data is invalid. Reset the lock to continue.');
  }

  return parsed as LocalCredentialRecord;
}

export async function hasLocalLockCredential(): Promise<boolean> {
  return (await readRecord()) !== null;
}

export async function getLocalLockMethod(): Promise<LockMethod | null> {
  const record = await readRecord();
  return record?.method ?? null;
}

export async function createLocalLockCredential(method: LockMethod, credential: string): Promise<void> {
  const salt = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const verifier = await createVerifier(method, credential, salt);
  const record: LocalCredentialRecord = {
    version: 1,
    method,
    salt,
    verifier,
    createdAt: new Date().toISOString(),
  };

  await SecureStore.setItemAsync(LOCAL_CREDENTIAL_KEY, JSON.stringify(record), secureStoreOptions);
}

export async function verifyLocalLockCredential(method: LockMethod, credential: string): Promise<boolean> {
  const record = await readRecord();
  if (!record || record.method !== method) return false;
  const candidate = await createVerifier(method, credential, record.salt);
  return valuesMatch(record.verifier, candidate);
}

export async function deleteLocalLockCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCAL_CREDENTIAL_KEY, secureStoreOptions);
}
