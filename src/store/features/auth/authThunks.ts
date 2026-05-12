/**
 * Authentication async thunks (Zustand action wrappers)
 *
 * Stub — implement when authentication is added to the backend.
 * Follows the pattern of wrapping async service calls in store actions.
 */

import { useAuthStore } from "./authSlice";
import * as authService from "@/services/auth.service";
import type { LoginCredentials } from "@/interfaces/authInterfaces";
import { logger } from "@/utils/logger";

/**
 * Login thunk — calls auth.service, stores tokens and user in authStore
 */
export async function loginThunk(credentials: LoginCredentials): Promise<void> {
  const { setUser, setLoading, setError } = useAuthStore.getState();
  setLoading(true);

  try {
    logger.debug("[authThunks] loginThunk", { email: credentials.email });
    const { user, tokens } = await authService.login(credentials);
    setUser(user, tokens.accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    setError(message);
    throw error;
  }
}

/**
 * Logout thunk — clears tokens and resets auth store
 */
export async function logoutThunk(accessToken: string): Promise<void> {
  const { clearAuth } = useAuthStore.getState();

  try {
    logger.debug("[authThunks] logoutThunk");
    await authService.logout(accessToken);
  } catch {
    // Swallow logout errors — always clear local state
  } finally {
    clearAuth();
  }
}
