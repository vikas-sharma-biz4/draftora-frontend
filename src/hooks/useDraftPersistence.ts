"use client";

import { useEffect, useCallback, useRef } from "react";
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
  approvalStatus?: "pending" | "approved" | "rejected";
  saveOnMount?: boolean;
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
    approvalStatus,
    saveOnMount,
  } = options;

  const hasMountSavedRef = useRef(false);

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

    // Skip auto-save for approved or rejected proposals (in History)
    if (approvalStatus === "approved" || approvalStatus === "rejected") {
      logger.debug('[useDraftPersistence] Skipping save for history proposal', { approvalStatus });
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

      // Use live proposal sections if non-empty; otherwise fall back to existing draft content
      let generatedContent: Record<string, string> = {};
      const proposalSections = proposal.sections as Record<string, string> | undefined;
      if (proposalSections && Object.keys(proposalSections).length > 0) {
        generatedContent = proposalSections;
      } else if (proposalId) {
        try {
          const existingDraft = await getDraftByProposalId(proposalId);
          if (existingDraft) {
            const fullDraft = await getDraft(existingDraft.id);
            generatedContent = fullDraft.generatedContent || {};
            logger.debug('[useDraftPersistence] Preserved existing generated content', {
              sectionCount: Object.keys(generatedContent).length
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
        generatedContent,
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
        try {
          await updateDraftInStore(currentDraftId, draftPayload);
          logger.info('[useDraftPersistence] Draft updated', { draftId: currentDraftId });
        } catch (updateError) {
          const is404 = updateError instanceof Error && (updateError as any).statusCode === 404;
          if (is404) {
            // Draft was deleted from backend — clear stale ID and create fresh
            logger.warn('[useDraftPersistence] Draft not found (404), creating new draft', { currentDraftId });
            setCurrentDraftId(null);
            const saved = await saveDraftToStore(draftPayload);
            setCurrentDraftId(saved.id);
            logger.info('[useDraftPersistence] Replacement draft created', { draftId: saved.id });
          } else {
            logger.error('[useDraftPersistence] Draft update failed', updateError);
          }
        }
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
    approvalStatus,
    currentDraftId,
    setCurrentDraftId,
    updateDraftInStore,
    saveDraftToStore,
  ]);

  // One-time save when the component mounts (e.g., web view page load after generation)
  useEffect(() => {
    if (!saveOnMount || hasMountSavedRef.current || !enabled || !proposal) return;
    hasMountSavedRef.current = true;
    void saveDraft();
  }, [saveOnMount, enabled, proposal, saveDraft]);

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
