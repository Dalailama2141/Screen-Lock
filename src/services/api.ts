import { Platform } from 'react-native';
import type { LockMethod } from '../types';

export type LockSettings = { deviceId: string; method: LockMethod };

const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 10000;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new Error(`Unable to reach the backend at ${apiUrl}`);
  }

  clearTimeout(timeoutId);

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

export async function deleteLockCredential(deviceId: string): Promise<{ deleted: boolean }> {
  try {
    return await request<{ deleted: boolean }>(`/lock-credentials/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    if ((error as Error & { status?: number }).status === 404) {
      return { deleted: false };
    }
    throw error;
  }
}
