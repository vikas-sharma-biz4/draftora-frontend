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

// ─── Granular Selector Hooks ─────────────────────────────────────────────────────

/**
 * Selector hooks for fine-grained Zustand subscriptions.
 *
 * Components should use these hooks to subscribe only to the specific state
 * they need, avoiding unnecessary re-renders when unrelated state changes.
 */

/**
 * Selects sidebar open state
 */
export const useSidebarOpen = () => useUIStore((state) => state.sidebarOpen);

/**
 * Selects global loading state
 */
export const useGlobalLoading = () => useUIStore((state) => state.globalLoading);

/**
 * Selects loading message
 */
export const useLoadingMessage = () => useUIStore((state) => state.loadingMessage);

/**
 * Selects active modal
 */
export const useActiveModal = () => useUIStore((state) => state.activeModal);

/**
 * Selects all UI actions (stable reference)
 */
export const useUIActions = () => useUIStore((state) => ({
  setSidebarOpen: state.setSidebarOpen,
  toggleSidebar: state.toggleSidebar,
  setGlobalLoading: state.setGlobalLoading,
  openModal: state.openModal,
  closeModal: state.closeModal,
  reset: state.reset,
}));
