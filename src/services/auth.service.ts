/**
 * Authentication service
 *
 * Stub — implement when authentication is added to the backend.
 * Follows the *.service.ts naming convention established in the project.
 */

import { http } from "@/config/httpClient";
import { logger } from "@/utils/logger";

export interface LoginCredentials {
  email:    string;
  password: string;
}

export interface AuthUser {
  id:         number;
  name:       string;
  email:      string;
  role:       string;
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken:  string;
  expiresIn:    number;
}

export interface LoginResponse {
  user:   AuthUser;
  tokens: AuthTokens;
}

const BASE = "/auth";

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  logger.debug("[auth.service] login", { email: credentials.email });
  const data = await http.post<LoginResponse>(`${BASE}/login`, credentials, {
    credentials: "include",
  });
  return data;
}

export async function logout(accessToken: string): Promise<void> {
  logger.debug("[auth.service] logout");
  await http.post<null>(`${BASE}/logout`, undefined, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
}

export async function refreshAccessToken(): Promise<AuthTokens> {
  const data = await http.post<AuthTokens>(`${BASE}/refresh`, undefined, {
    credentials: "include",
  });
  return data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await http.post<null>(`${BASE}/forgot-password`, { email });
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string
): Promise<void> {
  await http.post<null>(`${BASE}/reset-password`, { token, newPassword });
}
