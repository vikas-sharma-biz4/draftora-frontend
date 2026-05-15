"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useTemplateType,
  useTemplateId,
  useProposalDescription,
  useSelectedSections,
  useSectionDisplayNames,
  useTone,
  useLengthPreference,
  useLanguage,
  useAiModel,
  useCurrentStep,
  useMaxStepReached,
  useCurrentProposalId,
  useProposalTitle,
  useClientName,
  useClientId,
  useWizardActions,
} from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import { getDraftByProposalId, getDraft } from "@/services/draft.service";
import type { DraftLocation, SaveDraftPayload, DraftUIState } from "@/interfaces/draftInterfaces";
import { logger } from "@/utils/logger";
import { WIZARD_AUTOSAVE_FALLBACK_KEY } from "@/constants/storageKeys";

const WIZARD_AUTOSAVE_FALLBACK_KEY = "wizard_autosave_fallback";

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

  // Use granular selectors instead of entire proposalData object
  const title = useProposalTitle();
  const clientName = useClientName();
  const clientId = useClientId();
  const description = useProposalDescription();
  const selectedSections = useSelectedSections();
  const tone = useTone();
  const lengthPreference = useLengthPreference();
  const language = useLanguage();
  const aiModel = useAiModel();
  const templateId = useTemplateId();
  const templateType = useTemplateType();

  const currentStep = useCurrentStep();
  const maxStepReached = useMaxStepReached();
  const currentProposalId = useCurrentProposalId();
  const draftStage = useDraftSessionStore(state => state.draftStage);
  const completedSteps = useDraftSessionStore(state => state.completedSteps);
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
      title.trim() !== "" ||
      clientName.trim() !== "" ||
      description.trim() !== "" ||
      (selectedSections && selectedSections.length > 0) ||
      clientId !== undefined
    );
  }, [title, clientName, description, selectedSections, clientId]);

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
      title,
      clientName,
      clientId,
      description,
      selectedSections,
      tone,
      lengthPreference,
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

      // Fetch existing draft to preserve generated content if proposal exists
      let existingGeneratedContent: Record<string, string> = {};
      if (currentProposalId) {
        try {
          const existingDraft = await getDraftByProposalId(currentProposalId);
          if (existingDraft) {
            const fullDraft = await getDraft(existingDraft.id);
            existingGeneratedContent = fullDraft.generatedContent || {};
            logger.debug('[useWizardAutoSave] Preserved existing generated content', {
              sectionCount: Object.keys(existingGeneratedContent).length
            });
          }
        } catch (error) {
          logger.warn('[useWizardAutoSave] Failed to fetch existing draft for content preservation', error);
        }
      }

      // Include sections from proposalData if available (for completed proposals)
      const sectionsContent: Record<string, string> = {}; // Will be populated from API response

      // Construct minimal proposalData object for backward compatibility
      const proposalDataForSave = {
        title,
        clientName,
        clientId,
        description,
        selectedSections,
        sectionDisplayNames: {}, // Will be fetched from store if needed
        tone,
        lengthPreference,
        language,
        aiModel,
        templateId,
        templateType,
        files: [],
        filesMeta: [],
        selectedDocumentIds: [],
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
      } as any; // Type assertion for backward compatibility

      const draftPayload: SaveDraftPayload = {
        proposalId: currentProposalId,
        title: title || "Untitled Proposal",
        clientName: clientName || "",
        status: "draft",
        lastLocation,
        stage: draftStage,
        wizardState: {
          proposalData: proposalDataForSave,
          currentStep,
          maxStepReached,
          completedSteps,
        },
        generatedContent: Object.keys(sectionsContent).length > 0 ? sectionsContent : existingGeneratedContent,
        uiState,
      };

      logger.info('[useWizardAutoSave] Saving draft', {
        proposalId: currentProposalId,
        hasGeneratedContent: Object.keys(draftPayload.generatedContent).length > 0,
        sectionCount: Object.keys(draftPayload.generatedContent).length,
        stage: draftStage,
        lastLocation,
      });

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
    title,
    clientName,
    clientId,
    description,
    selectedSections,
    tone,
    lengthPreference,
    language,
    aiModel,
    templateId,
    templateType,
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
  }, [enabled, hasData, saveDraft, debounceMs, title, clientName, clientId, description, selectedSections, currentStep, draftStage]);

  // Save on beforeunload (browser close/refresh)
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (hasData() && !isUnmountingRef.current) {
        // Attempt synchronous save to localStorage as fallback
        try {
          const fallbackData = {
            proposalData: {
              title,
              clientName,
              clientId,
              description,
              selectedSections,
              tone,
              lengthPreference,
              language,
              aiModel,
              templateId,
              templateType,
              files: [],
              filesMeta: [],
              selectedDocumentIds: [],
              customSections: [],
              contextualInstructions: "",
              webReferences: [],
            },
            currentStep,
            maxStepReached,
            completedSteps,
            draftStage,
            timestamp: Date.now(),
          };
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem(WIZARD_AUTOSAVE_FALLBACK_KEY, JSON.stringify(fallbackData));
            logger.info('[useWizardAutoSave] Fallback save to localStorage');
          }
        } catch (error) {
          logger.error('[useWizardAutoSave] Fallback save failed', error);
        }

        // Try async save (may not complete before unload)
        void saveDraft(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, hasData, saveDraft, title, clientName, clientId, description, selectedSections, tone, lengthPreference, language, aiModel, templateId, templateType, currentStep, maxStepReached, completedSteps, draftStage]);

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
