/**
 * Zustand store for theme state management
 *
 * Migrated from ThemeContext (React Context) to Zustand to allow
 * selective subscriptions and eliminate Context provider overhead.
 * Maintains all existing functionality including localStorage persistence
 * and OS theme detection.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeState {
  theme: Theme;
  osPrefersDark: boolean;
  setTheme: (theme: Theme) => void;
  setOsPrefersDark: (prefersDark: boolean) => void;
  reset: () => void;
}

const initialState = {
  theme: 'light' as Theme,
  osPrefersDark: false,
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTheme: (theme: Theme) => {
        set({ theme });
        // Apply theme to document element
        if (typeof window !== 'undefined') {
          applyThemeToDocument(theme, get().osPrefersDark);
        }
      },

      setOsPrefersDark: (prefersDark: boolean) => {
        set({ osPrefersDark: prefersDark });
        // Re-apply theme when OS preference changes
        if (typeof window !== 'undefined') {
          applyThemeToDocument(get().theme, prefersDark);
        }
      },

      reset: () => {
        set(initialState);
        if (typeof window !== 'undefined') {
          // Reset to default theme
          applyThemeToDocument(initialState.theme, initialState.osPrefersDark);
        }
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => {
        // Use localStorage in browser, no-op in server
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({ theme: state.theme }), // Only persist theme, not OS preference
      onRehydrateStorage: () => (state) => {
        if (state && typeof window !== 'undefined') {
          // Apply persisted theme on rehydration
          applyThemeToDocument(state.theme, state.osPrefersDark);
        }
      },
    }
  )
);

/**
 * Applies theme to document element based on theme preference and OS setting
 */
function applyThemeToDocument(theme: Theme, osPrefersDark: boolean): void {
  const root = document.documentElement;
  const isDark = theme === 'system' ? osPrefersDark : theme === 'dark';

  if (isDark) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }
}

/**
 * Initialize OS theme detection listener
 */
export function initializeThemeDetection(): (() => void) | void {
  if (typeof window === 'undefined') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // Set initial OS preference
  useThemeStore.getState().setOsPrefersDark(mediaQuery.matches);

  // Listen for OS theme changes
  const handleChange = (e: MediaQueryListEvent) => {
    useThemeStore.getState().setOsPrefersDark(e.matches);
  };

  mediaQuery.addEventListener('change', handleChange);

  // Return cleanup function
  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}

// ─── Granular Selectors ──────────────────────────────────────────────────────

/**
 * Selects the current theme preference
 */
export const useTheme = () => useThemeStore((state) => state.theme);

/**
 * Selects whether the current theme is dark (resolved)
 */
export const useIsDark = () =>
  useThemeStore((state) => {
    const { theme, osPrefersDark } = state;
    return theme === 'system' ? osPrefersDark : theme === 'dark';
  });

/**
 * Selects the OS preference for dark mode
 */
export const useOsPrefersDark = () => useThemeStore((state) => state.osPrefersDark);

/**
 * Selects theme actions (stable reference)
 */
export const useThemeActions = () =>
  useThemeStore(
    useShallow((state) => ({
      setTheme: state.setTheme,
      setOsPrefersDark: state.setOsPrefersDark,
      reset: state.reset,
    }))
  );

/**
 * Selects complete theme state
 */
export const useThemeState = () =>
  useThemeStore(
    useShallow((state) => ({
      theme: state.theme,
      osPrefersDark: state.osPrefersDark,
      isDark: state.theme === 'system' ? state.osPrefersDark : state.theme === 'dark',
    }))
  );
