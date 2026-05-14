/**
 * ThemeProvider - Initializes theme state and OS detection
 *
 * This is a lightweight initialization component that:
 * 1. Sets up OS theme detection listener
 * 2. Handles initial theme hydration
 * 3. Applies theme to document element
 *
 * Unlike the old ThemeContext, this component does NOT manage state.
 * It only initializes the Zustand theme store and handles side effects.
 */

"use client";

import { useEffect } from 'react';
import { initializeThemeDetection } from '@/store/features/ui/themeSlice';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * ThemeProvider component that initializes theme functionality
 * without managing state (state is handled by Zustand store)
 */
export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  useEffect(() => {
    // Initialize OS theme detection and apply initial theme
    const cleanup = initializeThemeDetection();
    
    // Return cleanup function for component unmount
    return cleanup;
  }, []);

  return <>{children}</>;
}
