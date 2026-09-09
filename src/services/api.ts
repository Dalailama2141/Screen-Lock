import { Platform } from 'react-native';

export type User = {
  _id: string;
  name: string;
  email: string;
};

const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
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
