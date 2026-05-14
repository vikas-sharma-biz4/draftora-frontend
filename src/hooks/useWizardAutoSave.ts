"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getLastLocationFromPathname } from "@/utils/routeUtils";
import { useProposalWizard, useProposalDraftSession } from "@/context/ProposalContext";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import type { DraftLocation, SaveDraftPayload, DraftUIState } from "@/interfaces/draftInterfaces";
import { logger } from "@/utils/logger";
import { WIZARD_AUTOSAVE_FALLBACK_KEY } from "@/constants/storageKeys";

interface UseWizardAutoSaveOptions {
  enabled: boolean;
  debounceMs?: number;
}

/**
 * Production-grade auto-save hook for wizard/pipeline steps
 *
 * Features:
 * - Debounced auto-save on state changes
 * - Save on route navigation
 * - Save on browser close/refresh (beforeunload)
 * - Save on tab visibility change
 * - Save on component unmount
 * - Prevents data loss in all scenarios
 */
export function useWizardAutoSave(options: UseWizardAutoSaveOptions = { enabled: true }): void {
  const { enabled, debounceMs = 2000 } = options;

  const {
    proposalData,
    currentStep,
    maxStepReached,
    currentProposalId,
  } = useProposalWizard();

  const { draftStage, completedSteps } = useProposalDraftSession();
  const currentDraftId = useDraftSessionStore(state => state.currentDraftId);
  const setCurrentDraftId = useDraftSessionStore(state => state.setCurrentDraftId);
  const saveDraftToStore = useDraftStore(state => state.saveDraft);
  const updateDraftInStore = useDraftStore(state => state.updateDraftApi);

  const pathname = usePathname();
  const router = useRouter();

  // Refs to track state without causing re-renders
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");
  const isSavingRef = useRef<boolean>(false);
  const isUnmountingRef = useRef<boolean>(false);

  // Determine lastLocation based on current pathname
  const getLastLocation = useCallback((): DraftLocation => {
    return getLastLocationFromPathname(pathname);
  }, [pathname]);

  // Check if there's meaningful data to save
  const hasData = useCallback((): boolean => {
    return (
      proposalData.title.trim() !== "" ||
      proposalData.clientName.trim() !== "" ||
      proposalData.description.trim() !== "" ||
      (proposalData.selectedSections && proposalData.selectedSections.length > 0) ||
      proposalData.clientId !== undefined
    );
  }, [proposalData]);

  // Capture UI state for restoration
  const captureUIState = useCallback((): DraftUIState => {
    return {
      scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
      activeSection: null,
      expandedSections: [],
      lastVisibleSection: null,
    };
  }, []);

  // Core save function
  const saveDraft = useCallback(async (force: boolean = false): Promise<void> => {
    if (!enabled || isSavingRef.current) return;
    if (!hasData()) {
      logger.debug('[useWizardAutoSave] No data to save');
      return;
    }

    // Create a hash of current data to detect changes
    const currentDataHash = JSON.stringify({
      title: proposalData.title,
      clientName: proposalData.clientName,
      clientId: proposalData.clientId,
      description: proposalData.description,
      selectedSections: proposalData.selectedSections,
      tone: proposalData.tone,
      lengthPreference: proposalData.lengthPreference,
    });

    // Skip if data hasn't changed (unless forced)
    if (!force && currentDataHash === lastSavedDataRef.current) {
      logger.debug('[useWizardAutoSave] No changes detected, skipping save');
      return;
    }

    isSavingRef.current = true;

    try {
      const uiState = captureUIState();
      const lastLocation = getLastLocation();

      const draftPayload: SaveDraftPayload = {
        proposalId: currentProposalId,
        title: proposalData.title || "Untitled Proposal",
        clientName: proposalData.clientName || "",
        status: "draft",
        lastLocation,
        stage: draftStage,
        wizardState: {
          proposalData: { ...proposalData, files: [] },
          currentStep,
          maxStepReached,
          completedSteps,
        },
        generatedContent: {},
        uiState,
      };

      if (currentDraftId) {
        // Update existing draft
        logger.info('[useWizardAutoSave] Updating existing draft:', { draftId: currentDraftId });
        await updateDraftInStore(currentDraftId, draftPayload);
        logger.info('[useWizardAutoSave] Draft updated', { draftId: currentDraftId });
      } else {
        // Create new draft — only store backend-generated ID on success
        logger.info('[useWizardAutoSave] Creating new draft...');
        const saved = await saveDraftToStore(draftPayload);
        if (!saved.id) {
          throw new Error('saveDraft returned empty id');
        }
        setCurrentDraftId(saved.id);
        logger.info('[useWizardAutoSave] Draft created, backend ID:', saved.id);
      }

      // Update last saved data hash
      lastSavedDataRef.current = currentDataHash;
    } catch (error) {
      logger.error('[useWizardAutoSave] Save failed', error);
    } finally {
      isSavingRef.current = false;
    }
  }, [
    enabled,
    hasData,
    proposalData,
    currentStep,
    maxStepReached,
    completedSteps,
    draftStage,
    currentProposalId,
    currentDraftId,
    captureUIState,
    getLastLocation,
    saveDraftToStore,
    updateDraftInStore,
    setCurrentDraftId,
  ]);

  // Debounced auto-save on data changes
  useEffect(() => {
    if (!enabled || !hasData()) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      void saveDraft(false);
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, hasData, saveDraft, debounceMs, proposalData, currentStep, draftStage]);

  // Save on beforeunload (browser close/refresh)
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (hasData() && !isUnmountingRef.current) {
        // Attempt synchronous save to localStorage as fallback
        try {
          const fallbackData = {
            proposalData: { ...proposalData, files: [] },
            currentStep,
            maxStepReached,
            completedSteps,
            draftStage,
            timestamp: Date.now(),
          };
          localStorage.setItem(WIZARD_AUTOSAVE_FALLBACK_KEY, JSON.stringify(fallbackData));
          logger.info('[useWizardAutoSave] Fallback save to localStorage');
        } catch (error) {
          logger.error('[useWizardAutoSave] Fallback save failed', error);
        }

        // Try async save (may not complete before unload)
        void saveDraft(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, hasData, saveDraft, proposalData, currentStep, maxStepReached, completedSteps, draftStage]);

  // Save on visibility change (tab switch)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = (): void => {
      if (document.hidden && hasData()) {
        logger.info('[useWizardAutoSave] Tab hidden, saving draft');
        void saveDraft(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, hasData, saveDraft]);

  // Save on component unmount
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (hasData()) {
        logger.info('[useWizardAutoSave] Component unmounting, saving draft');
        void saveDraft(true);
      }
    };
  }, [hasData, saveDraft]);

  // Save on route change (Next.js navigation)
  useEffect(() => {
    if (!enabled) return;

    // Save when pathname changes (user navigates away)
    const handleRouteChange = (): void => {
      if (hasData() && !isUnmountingRef.current) {
        logger.info('[useWizardAutoSave] Route changing, saving draft');
        void saveDraft(true);
      }
    };

    // Next.js doesn't expose a direct route change event, but pathname changes trigger this effect
    // We save on pathname change as a proxy for route navigation
    handleRouteChange();
  }, [pathname, enabled, hasData, saveDraft]);
}
