import { api, tokenStore } from './client';

export interface LoginResponse {
  access: string;
  refresh: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/v1/auth/login/', { email, password });
  const { access, refresh } = response.data;
  await tokenStore.set(access, refresh);
  return response.data;
}

export async function logout(): Promise<void> {
  await tokenStore.clear();
}

export async function getMe() {
  const response = await api.get('/api/v1/users/me/');
  return response.data;
}
