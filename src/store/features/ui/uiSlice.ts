/**
 * Zustand store for global UI state management
 *
 * Manages:
 * - Sidebar open/collapsed state (persisted to localStorage)
 * - Global loading overlay
 * - Active modal tracking
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

export const INITIAL_UI_STATE = {
  sidebarOpen: true,
  globalLoading: false,
  loadingMessage: null as string | null,
  activeModal: null as string | null,
};

interface UIState {
  // Sidebar
  sidebarOpen: boolean;

  // Global loading overlay
  globalLoading: boolean;
  loadingMessage: string | null;

  // Active modal (track by name to prevent duplicates)
  activeModal: string | null;

  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  setGlobalLoading: (loading: boolean, message?: string) => void;

  openModal: (name: string) => void;
  closeModal: () => void;
  reset: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarOpen: true,
      globalLoading: false,
      loadingMessage: null,
      activeModal: null,

      // Sidebar actions
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Loading actions
      setGlobalLoading: (loading: boolean, message?: string) =>
        set({ globalLoading: loading, loadingMessage: message ?? null }),

      // Modal actions
      openModal: (name: string) => set({ activeModal: name }),
      closeModal: () => set({ activeModal: null }),

      reset: () => set(INITIAL_UI_STATE),
    }),
    {
      name: "draftora-ui",
      storage: createJSONStorage(() => localStorage),
      // Only persist sidebar state — loading and modal state is always ephemeral
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    }
  )
);
