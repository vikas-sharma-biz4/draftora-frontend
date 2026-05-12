/**
 * useAuth — convenience hook for authentication state and actions
 *
 * Stub — returns mocked/default values until authentication is implemented.
 * Wire up to useAuthStore + authThunks when the auth backend is ready.
 */

import { useAuthStore } from "@/store/features/auth/authSlice";
import { loginThunk, logoutThunk } from "@/store/features/auth/authThunks";
import { getAccessToken } from "@/utils/auth";
import type { AuthUser } from "@/interfaces/authInterfaces";

interface UseAuthReturn {
  user:            AuthUser | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  error:           string | null;
  accessToken:     string | null;
  login:           (email: string, password: string) => Promise<void>;
  logout:          () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const { user, isAuthenticated, isLoading, error } = useAuthStore();

  const login = async (email: string, password: string): Promise<void> => {
    await loginThunk({ email, password });
  };

  const logout = async (): Promise<void> => {
    const token = getAccessToken() ?? "";
    await logoutThunk(token);
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    accessToken: getAccessToken(),
    login,
    logout,
  };
}
