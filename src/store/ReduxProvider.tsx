"use client";

/**
 * ReduxProvider — store initialisation wrapper
 *
 * Note: Zustand stores are module-level singletons and do not require
 * a React context Provider. This component exists for structural parity
 * with the production-grade architecture and can be used to:
 *   - Run any store initialisation side-effects on mount
 *   - Wrap the app with additional global providers in the future
 *   - House DevTools setup (e.g. zustand/middleware devtools)
 *
 * Usage in src/app/layout.tsx:
 *   <ReduxProvider>{children}</ReduxProvider>
 */

import React from "react";

interface StoreProviderProps {
  children: React.ReactNode;
}

export default function StoreProvider({ children }: StoreProviderProps): JSX.Element {
  return <>{children}</>;
}
