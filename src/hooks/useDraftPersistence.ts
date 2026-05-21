"use client";

import { useEffect, useCallback } from "react";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import { getDraftByProposalId, getDraft, updateDraft as updateDraftApi } from "@/services/draft.service";
import type { DraftLocation, DraftUIState, SaveDraftPayload } from "@/interfaces/draftInterfaces";
import type { ProposalData } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";

interface UseDraftPersistenceOptions {
  enabled: boolean;
  proposalId: number | null;
  proposal: ProposalData | null;
  activeSection: string;
  lastLocation: DraftLocation;
  stage: string;
  wizardStep: number;
  skipIfApproved: boolean;
}

/**
 * Auto-saves the current proposal state to backend database when:
 * - The browser is closing (beforeunload event)
 * - The tab is hidden (visibilitychange event)
 *
 * This is a lower-level persistence hook that handles the actual save logic.
 * It's used by higher-level hooks like useDraftAutoSave and useWizardAutoSave.
 */
export function useDraftPersistence(options: UseDraftPersistenceOptions): void {
  const {
    enabled,
    proposalId,
    proposal,
    activeSection,
    lastLocation,
    stage,
    wizardStep,
    skipIfApproved,
  } = options;

  const currentDraftId = useDraftSessionStore(state => state.currentDraftId);
  const setCurrentDraftId = useDraftSessionStore(state => state.setCurrentDraftId);
  const updateDraftInStore = useDraftStore(state => state.updateDraftApi);
  const saveDraftToStore = useDraftStore(state => state.saveDraft);

  const saveDraft = useCallback(async (): Promise<void> => {
    if (!enabled || !proposal) {
      logger.debug('[useDraftPersistence] Save disabled or no proposal data');
      return;
    }

    if (!proposalId) {
      logger.debug('[useDraftPersistence] No proposalId, skipping save');
      return;
    }

    try {
      // Capture UI state for restoration
      const uiState: DraftUIState = {
        scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
        activeSection: activeSection || null,
        expandedSections: [],
        lastVisibleSection: null,
      };

      // Fetch existing draft to preserve generated content if proposal exists
      let existingGeneratedContent: Record<string, string> = {};
      if (proposalId) {
        try {
          const existingDraft = await getDraftByProposalId(proposalId);
          if (existingDraft) {
            const fullDraft = await getDraft(existingDraft.id);
            existingGeneratedContent = fullDraft.generatedContent || {};
            logger.debug('[useDraftPersistence] Preserved existing generated content', {
              sectionCount: Object.keys(existingGeneratedContent).length
            });
          }
        } catch (error) {
          logger.warn('[useDraftPersistence] Failed to fetch existing draft for content preservation', error);
        }
      }

      // Construct wizard state
      const wizardState = {
        proposalData: proposal,
        currentStep: wizardStep as any,
        maxStepReached: wizardStep as any,
        completedSteps: [],
      };

      const draftPayload: SaveDraftPayload = {
        proposalId,
        title: proposal.title || "Untitled Proposal",
        clientName: proposal.clientName || "",
        status: (proposal.status as any) || "draft",
        lastLocation,
        stage: stage as any,
        wizardState,
        generatedContent: existingGeneratedContent,
        uiState,
      };

      logger.info('[useDraftPersistence] Saving draft', {
        proposalId,
        hasGeneratedContent: Object.keys(draftPayload.generatedContent).length > 0,
        sectionCount: Object.keys(draftPayload.generatedContent).length,
        stage,
        lastLocation,
      });

      if (currentDraftId) {
        // Update existing draft
        await updateDraftInStore(currentDraftId, draftPayload);
        logger.info('[useDraftPersistence] Draft updated', { draftId: currentDraftId });
      } else {
        // Create new draft and store ID
        const saved = await saveDraftToStore(draftPayload);
        setCurrentDraftId(saved.id);
        logger.info('[useDraftPersistence] Draft created', { draftId: saved.id });
      }
    } catch (error) {
      logger.error('[useDraftPersistence] Save failed', error);
    }
  }, [
    enabled,
    proposal,
    proposalId,
    activeSection,
    lastLocation,
    stage,
    wizardStep,
    skipIfApproved,
    currentDraftId,
    setCurrentDraftId,
    updateDraftInStore,
    saveDraftToStore,
  ]);

  // Save on beforeunload (browser close/refresh)
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (proposal) {
        // Try async save (may not complete before unload)
        void saveDraft();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, proposal, saveDraft]);

  // Save on visibility change (tab switch)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = (): void => {
      if (document.hidden && proposal) {
        logger.info('[useDraftPersistence] Tab hidden, saving draft');
        void saveDraft();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, proposal, saveDraft]);
}
