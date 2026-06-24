/**
 * Central store registry for application-wide state reset.
 *
 * Call resetAllStores() on logout (or any full session teardown) to clear
 * all Zustand state. Every store slice must register its reset() here.
 *
 * When adding a new store slice:
 *   1. Import the store hook from its slice file (not from store/hooks.ts)
 *   2. Add a reset() call inside resetAllStores()
 *   3. Ensure the slice exposes a reset() action
 */

import { useClientStore } from "./features/clients/clientSlice";
import { useDraftStore } from "./features/drafts/draftSlice";
import { useDraftSessionStore } from "./features/drafts/draftSessionSlice";
import { useGenerationStore } from "./features/generation/generationSlice";
import { useNotificationsStore } from "./features/notifications/notificationsSlice";
import { usePipelineStore } from "./features/pipeline/pipelineSlice";
import { useProposalStore } from "./features/proposals/proposalSlice";
import { useUIStore } from "./features/ui/uiSlice";
import { useProposalWizardStore } from "./features/wizard/proposalWizardSlice";

export function resetAllStores(): void {
  useClientStore.getState().reset();
  useDraftStore.getState().reset();
  useDraftSessionStore.getState().reset();
  useGenerationStore.getState().reset();
  useNotificationsStore.getState().reset();
  usePipelineStore.getState().reset();
  useProposalStore.getState().reset();
  useUIStore.getState().reset();
  useProposalWizardStore.getState().reset();
}
