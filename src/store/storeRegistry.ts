/**
 * Store registry — documents all Zustand stores in the application
 *
 * Note: This project uses Zustand (not Redux RTK).
 * There is no root reducer to combine. This file serves as:
 *   1. A central registry of all stores
 *   2. A provider of the `resetAllStores()` utility for testing / logout flows
 *
 * Store map:
 *   clients         → src/store/features/clients/clientSlice.ts
 *   drafts          → src/store/features/drafts/draftSlice.ts
 *   draftSession    → src/store/features/drafts/draftSessionSlice.ts
 *   proposals       → src/store/features/proposals/proposalSlice.ts
 *   proposalWizard  → src/store/features/wizard/proposalWizardSlice.ts
 *   pipeline        → src/store/features/pipeline/pipelineSlice.ts
 *   ui              → src/store/features/ui/uiSlice.ts
 *   theme           → src/store/features/ui/themeSlice.ts (migrated from ThemeContext)
 *   notifications   → src/store/features/notifications/notificationsSlice.ts
 */

import { useClientStore } from './features/clients/clientSlice';
import { useDraftStore } from './features/drafts/draftSlice';
import { useDraftSessionStore } from './features/drafts/draftSessionSlice';
import { useProposalStore } from './features/proposals/proposalSlice';
import { useProposalWizardStore } from './features/wizard/proposalWizardSlice';
import { usePipelineStore } from './features/pipeline/pipelineSlice';
import { useUIStore } from './features/ui/uiSlice';
import { useThemeStore } from './features/ui/themeSlice';
import { useNotificationsStore } from './features/notifications/notificationsSlice';

/**
 * Resets all Zustand stores to their initial state.
 * Each store exposes a `reset()` action backed by its own INITIAL_*_STATE constant,
 * eliminating the duplicate state shapes that previously lived in this file.
 *
 * Useful for logout flows and test teardown.
 */
export function resetAllStores(): void {
  useClientStore.getState().reset();
  useDraftStore.getState().reset();
  useDraftSessionStore.getState().reset();
  useProposalStore.getState().reset();
  useProposalWizardStore.getState().reset();
  usePipelineStore.getState().reset();
  useUIStore.getState().reset();
  useThemeStore.getState().reset();
  useNotificationsStore.getState().reset();
}
