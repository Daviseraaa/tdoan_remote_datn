import { apiFetch } from '@/src/lib/api';
import type { LoginResponse, User } from '@/src/types/api';

export async function loginWithGoogle(idToken: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/google', {
    method: 'POST',
    body: { idToken },
    skipAuth: true,
  });
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

export interface SendRegisterOtpResponse {
  message: string;
  expiresInSeconds: number;
  cooldownSeconds: number;
}

export async function sendRegisterOtp(email: string): Promise<SendRegisterOtpResponse> {
  return apiFetch<SendRegisterOtpResponse>('/auth/register/send-otp', {
    method: 'POST',
    body: { email },
    skipAuth: true,
  });
}

export async function register(
  name: string,
  email: string,
  password: string,
  otp: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/register', {
    method: 'POST',
    body: { name, email, password, otp },
    skipAuth: true,
  });
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' });
}
