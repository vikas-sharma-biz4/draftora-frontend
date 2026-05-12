/**
 * User profile service
 *
 * Stub — implement when user management is added to the backend.
 * Follows the *.service.ts naming convention established in the project.
 */

import { http } from "@/config/httpClient";
import { logger } from "@/utils/logger";
import type { AuthUser } from "@/services/auth.service";

export interface UpdateProfileRequest {
  name?:      string;
  email?:     string;
  avatarUrl?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword:     string;
}

const BASE = "/users";

export async function getProfile(accessToken: string): Promise<AuthUser> {
  logger.debug("[user.service] getProfile");
  const data = await http.get<{ data: AuthUser }>(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data.data;
}

export async function updateProfile(
  accessToken: string,
  updates: UpdateProfileRequest
): Promise<AuthUser> {
  logger.debug("[user.service] updateProfile");
  const result = await http.patch<{ data: AuthUser }>(`${BASE}/me`, updates, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return result.data;
}

export async function changePassword(
  accessToken: string,
  payload: ChangePasswordRequest
): Promise<void> {
  await http.put<null>(`${BASE}/me/password`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function uploadAvatar(
  accessToken: string,
  file: File
): Promise<{ avatarUrl: string }> {
  logger.debug("[user.service] uploadAvatar");
  const formData = new FormData();
  formData.append("avatar", file);
  const data = await http.post<{ avatarUrl: string }>(`${BASE}/me/avatar`, formData, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}
