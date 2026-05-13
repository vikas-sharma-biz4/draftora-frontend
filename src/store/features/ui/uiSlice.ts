/**
 * Zustand store for global UI state management
 *
 * Manages:
 * - Sidebar open/collapsed state
 * - Global loading overlay
 * - Active modal tracking
 *
 * Note: Theme is managed by ThemeContext (src/context/ThemeContext.tsx)
 */

import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

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

export const useUIStore = create<UIState>((set) => ({
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
}));
