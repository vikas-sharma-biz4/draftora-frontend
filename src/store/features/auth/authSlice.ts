/**
 * Zustand store for authentication state
 *
 * Stub — wire up to auth.service.ts when authentication is added.
 * Follows the Zustand slice pattern used by clientSlice, draftSlice, etc.
 */

import { create } from "zustand";
import type { AuthUser } from "@/interfaces/authInterfaces";
import { setAccessToken, clearTokens } from "@/utils/auth";

interface AuthState {
  // State
  user:            AuthUser | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  error:           string | null;

  // Actions
  setUser:    (user: AuthUser, accessToken: string) => void;
  clearAuth:  () => void;
  setLoading: (loading: boolean) => void;
  setError:   (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:            null,
  isAuthenticated: false,
  isLoading:       false,
  error:           null,

  setUser: (user, accessToken) => {
    setAccessToken(accessToken);
    set({ user, isAuthenticated: true, error: null });
  },

  clearAuth: () => {
    clearTokens();
    set({ user: null, isAuthenticated: false, error: null });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError:   (error)   => set({ error, isLoading: false }),
}));
