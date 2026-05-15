"use client";

import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/utils/toast";
import { MESSAGES } from "@/constants/messages";
import { logger } from "@/utils/logger";

import {
  useProposalData,
  useCurrentStep,
  useMaxStepReached,
  useCurrentProposalId,
  useWizardActions,
} from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { updateDraft as updateDraftApi, getDraftByProposalId, getDraft } from "@/services/draft.service";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import type { DraftLocation, DraftUIState } from "@/interfaces/draftInterfaces";

const DRAFT_SAVE_LOCK_KEY = "draft_save_lock";

/**
 * Returns a `saveDraft` function that persists the current wizard state to
 * the backend database, resets the wizard, and navigates back to the root.
 */
export function useSaveDraft(): () => Promise<void> {
  const proposalData = useProposalData();
  const currentStep = useCurrentStep();
  const maxStepReached = useMaxStepReached();
  const currentProposalId = useCurrentProposalId();
  const { resetProposal } = useWizardActions();
  const completedSteps = useDraftSessionStore(state => state.completedSteps);
  const router = useRouter();
  const pathname = usePathname();
  const currentDraftId = useDraftSessionStore(state => state.currentDraftId);
  const draftStage = useDraftSessionStore(state => state.draftStage);
  const setCurrentDraftId = useDraftSessionStore(state => state.setCurrentDraftId);
  const invalidateCache = useDraftStore(state => state.invalidateCache);
  const saveDraftToStore = useDraftStore(state => state.saveDraft);
  const updateDraftInStore = useDraftStore(state => state.updateDraftApi);

  return async function saveDraft(): Promise<void> {
    // Use localStorage-based lock to prevent concurrent saves across page navigations
    const lockValue = localStorage.getItem(DRAFT_SAVE_LOCK_KEY);
    if (lockValue === 'locked') {
      logger.debug('[useSaveDraft] Save already locked, skipping');
      return;
    }

    const { title, clientName } = proposalData;
    const hasData = title.trim() !== "" || clientName.trim() !== "";

    if (!hasData) {
      toast.error("Nothing to save — add a title or client name first.");
      return;
    }

    if (clientName.trim() === "") {
      toast.error("Please enter a client name before saving the draft.");
      return;
    }

    // Set localStorage lock immediately
    localStorage.setItem(DRAFT_SAVE_LOCK_KEY, 'locked');

    try {
      // Determine lastLocation based on current pathname
      const lastLocation: DraftLocation = (() => {
        if (pathname === "/parameters") return "wizard_parameters";
        if (pathname === "/review") return "wizard_review";
        if (pathname.startsWith("/proposal/")) return "web_view";
        return "wizard_parameters";
      })();

      // Capture UI state for restoration
      const uiState: DraftUIState = {
        scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
        activeSection: null,
        expandedSections: [],
        lastVisibleSection: null,
      };

      // Fetch existing draft to preserve generated content if proposal exists
      let existingGeneratedContent: Record<string, string> = {};
      if (currentProposalId) {
        try {
          const existingDraft = await getDraftByProposalId(currentProposalId);
          if (existingDraft) {
            const fullDraft = await getDraft(existingDraft.id);
            existingGeneratedContent = fullDraft.generatedContent || {};
            logger.info('[useSaveDraft] Preserved existing generated content', {
              sectionCount: Object.keys(existingGeneratedContent).length
            });
          }
        } catch (error) {
          logger.warn('[useSaveDraft] Failed to fetch existing draft for content preservation', error);
        }
      }

      // Include sections from proposalData if available (for completed proposals)
      const sectionsContent: Record<string, string> = {};

      // Use the entire proposalData object to preserve all fields
      const draftProposalData = {
        ...proposalData,
        // Override files with empty array to avoid circular serialization
        files: [],
        // Override sections with generated content if available
        sections: sectionsContent,
      };

      const draftPayload = {
        proposalId: currentProposalId,
        title: proposalData.title || "Untitled Proposal",
        clientName: proposalData.clientName || "",
        status: "draft" as const,
        lastLocation,
        stage: draftStage,
        wizardState: {
          proposalData: draftProposalData,
          currentStep,
          maxStepReached,
          completedSteps,
        },
        generatedContent: Object.keys(sectionsContent).length > 0 ? sectionsContent : existingGeneratedContent,
        uiState,
      };

      logger.info('[useSaveDraft] Saving draft', {
        proposalId: currentProposalId,
        hasGeneratedContent: Object.keys(draftPayload.generatedContent).length > 0,
        sectionCount: Object.keys(draftPayload.generatedContent).length,
        stage: draftStage,
        lastLocation,
      });

      if (currentDraftId) {
        // Update existing draft
        logger.info('[useSaveDraft] Updating draft:', { draftId: currentDraftId });
        await updateDraftInStore(currentDraftId, draftPayload);
        toast.success(MESSAGES.DRAFT_SAVED);
      } else {
        // Create new draft — only store backend-generated ID
        logger.info('[useSaveDraft] Creating new draft...');
        const saved = await saveDraftToStore(draftPayload);
        if (!saved.id) {
          throw new Error('saveDraft returned empty id');
        }
        setCurrentDraftId(saved.id);
        logger.info('[useSaveDraft] Draft created, backend ID:', saved.id);
        toast.success(MESSAGES.DRAFT_SAVED);
      }

      // Invalidate cache to force fresh fetch on drafts page
      invalidateCache();

      // Navigate first, then reset to avoid infinite re-render loop
      router.push("/");

      // Reset after navigation to prevent @dnd-kit infinite loop
      setTimeout(() => {
        resetProposal();
      }, 100);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save draft";
      toast.error(message);
      throw error;
    } finally {
      localStorage.removeItem(DRAFT_SAVE_LOCK_KEY);
    }
  };
}
