import { Platform } from 'react-native';
import type { LockMethod } from '../../types';

export type User = {
  _id: string;
  name: string;
  email: string;
};

export type LockSettings = { deviceId: string; method: LockMethod };

const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
  } catch {
    throw new Error(`Unable to reach the backend at ${apiUrl}`);
  }

  if (!response.ok) {
    const error = new Error(`Backend request failed: ${response.status}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

export async function getLockSettings(deviceId: string): Promise<LockSettings | null> {
  try {
    return await request<LockSettings>(`/lock-credentials/${encodeURIComponent(deviceId)}`);
  } catch (error) {
    if ((error as Error & { status?: number }).status === 404) return null;
    throw error;
  }
}

export function saveLockCredential(deviceId: string, method: LockMethod, credential: string): Promise<LockSettings> {
  return request<LockSettings>(`/lock-credentials/${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ method, credential }),
  });
}

export async function verifyLockCredential(deviceId: string, credential: string): Promise<boolean> {
  const result = await request<{ valid: boolean }>(`/lock-credentials/${encodeURIComponent(deviceId)}/verify`, {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
  return result.valid;
}

export function getUsers(): Promise<User[]> {
  return request<User[]>('/users');
}

export function createUser(name: string, email: string): Promise<User> {
  return request<User>('/users', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  });
}
