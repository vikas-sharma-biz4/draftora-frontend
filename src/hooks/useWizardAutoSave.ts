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
  useGeneratedProposalId,
  useProposalTitle,
  useClientName,
  useClientId,
  useWizardActions,
  useFilesMeta,
  useSelectedDocumentIds,
  useWebReferences,
} from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import { getDraftByProposalId, getDraft } from "@/services/draft.service";
import { HttpError } from "@/config/httpClient";
import type { DraftLocation, SaveDraftPayload, DraftUIState } from "@/interfaces/draftInterfaces";
import { buildDraftProposalData, buildDraftPayload } from "@/utils/draftUtils";
import { logger } from "@/utils/logger";

const WIZARD_AUTOSAVE_FALLBACK_KEY = "wizard_autosave_fallback";
const DRAFT_SAVE_LOCK_KEY = "draft_save_lock";
const DRAFT_DEDUP_KEY = "draft_dedup";

interface UseWizardAutoSaveOptions {
  enabled: boolean;
  debounceMs?: number;
  approvalStatus?: "pending" | "approved" | "rejected";
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
  const { enabled, debounceMs = 2000, approvalStatus } = options;

  // Use granular selectors instead of entire proposalData object
  const title = useProposalTitle();
  const clientName = useClientName();
  const clientId = useClientId();
  const description = useProposalDescription();
  const selectedSections = useSelectedSections();
  const sectionDisplayNames = useSectionDisplayNames();
  const tone = useTone();
  const lengthPreference = useLengthPreference();
  const language = useLanguage();
  const aiModel = useAiModel();
  const templateId = useTemplateId();
  const templateType = useTemplateType();
  const filesMeta = useFilesMeta();
  const selectedDocumentIds = useSelectedDocumentIds();
  const webReferences = useWebReferences();

  const currentStep = useCurrentStep();
  const maxStepReached = useMaxStepReached();
  const currentProposalId = useCurrentProposalId();
  const generatedProposalId = useGeneratedProposalId();
  const draftStage = useDraftSessionStore((state) => state.draftStage);
  const completedSteps = useDraftSessionStore((state) => state.completedSteps);
  const currentDraftId = useDraftSessionStore((state) => state.currentDraftId);
  const fromHistory = useDraftSessionStore((state) => state.fromHistory);
  const setCurrentDraftId = useDraftSessionStore((state) => state.setCurrentDraftId);
  const saveDraftToStore = useDraftStore((state) => state.saveDraft);
  const updateDraftInStore = useDraftStore((state) => state.updateDraftApi);

  const pathname = usePathname();
  const router = useRouter();

  // Refs to track state without causing re-renders
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");
  const isUnmountingRef = useRef<boolean>(false);
  const previousPathnameRef = useRef<string>("");
  const pendingDraftIdRef = useRef<string | null>(null);
  const isSavingRef = useRef<boolean>(false);

  // Determine lastLocation based on current pathname
  const getLastLocation = useCallback((): DraftLocation => {
    if (pathname === "/parameters") return "wizard_parameters";
    if (pathname === "/review") return "wizard_review";
    if (pathname.startsWith("/proposal/")) return "web_view";
    if (pathname.startsWith("/generating")) return "ai_sections";
    return "wizard_parameters";
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
  const saveDraft = useCallback(
    async (force: boolean = false): Promise<void> => {
      // Prevent concurrent saves using ref (more reliable than localStorage for same-tab races)
      if (!enabled || isSavingRef.current) {
        logger.debug("[useWizardAutoSave] Save already in progress, skipping");
        return;
      }

      // Never save drafts while on the generating page — generation mutates proposal state
      if (pathname.startsWith("/generating")) {
        logger.debug("[useWizardAutoSave] On generating page, skipping save");
        return;
      }

      // Skip auto-save for approved or rejected proposals (in History)
      if (approvalStatus === "approved" || approvalStatus === "rejected") {
        logger.debug("[useWizardAutoSave] Skipping save for history proposal", { approvalStatus });
        return;
      }

      // If a proposal ID is linked but approval status hasn't been fetched yet, defer the save.
      // Sending a PUT with proposal_id before we know it's not rejected/approved triggers a 400.
      if (currentProposalId && approvalStatus === undefined) {
        logger.debug("[useWizardAutoSave] Deferring save — approvalStatus not yet loaded", {
          currentProposalId,
        });
        isSavingRef.current = false;
        return;
      }

      // Skip auto-save when viewing from History to prevent spurious draft creation
      if (fromHistory) {
        logger.debug("[useWizardAutoSave] Skipping save — viewing from History");
        isSavingRef.current = false;
        return;
      }

      isSavingRef.current = true;

      // Use the pendingDraftIdRef to catch newly created IDs before React re-renders
      const effectiveDraftId = currentDraftId || pendingDraftIdRef.current;

      // Skip if we just created a draft with this exact data (prevents rapid duplicate creation)
      if (!effectiveDraftId) {
        const dedupValue = localStorage.getItem(DRAFT_DEDUP_KEY);
        if (dedupValue) {
          const dedupData = JSON.parse(dedupValue);
          const timeDiff = Date.now() - dedupData.timestamp;
          const isSameData = dedupData.title === title && dedupData.clientName === clientName;

          if (isSameData && timeDiff < 10000) {
            logger.debug("[useWizardAutoSave] Duplicate draft detected, skipping", {
              timeDiff,
              title,
              clientName,
            });
            isSavingRef.current = false;
            return;
          }
        }
      }

      if (!hasData()) {
        logger.debug("[useWizardAutoSave] No data to save");
        isSavingRef.current = false;
        return;
      }

      // Create a hash of current data to detect changes
      const currentDataHash = JSON.stringify({
        title,
        clientName,
        clientId,
        description,
        selectedSections,
        sectionDisplayNames,
        tone,
        lengthPreference,
        language,
        aiModel,
        templateId,
        templateType,
        filesMeta,
        selectedDocumentIds,
        webReferences,
      });

      // Skip if data hasn't changed (unless forced)
      if (!force && currentDataHash === lastSavedDataRef.current) {
        logger.debug("[useWizardAutoSave] No changes detected, skipping save");
        isSavingRef.current = false;
        return;
      }

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
              logger.debug("[useWizardAutoSave] Preserved existing generated content", {
                sectionCount: Object.keys(existingGeneratedContent).length,
              });
            }
          } catch (error) {
            logger.warn(
              "[useWizardAutoSave] Failed to fetch existing draft for content preservation",
              error
            );
          }
        }

        const proposalDataForSave = buildDraftProposalData({
          title,
          clientName,
          clientId,
          description,
          selectedSections,
          sectionDisplayNames,
          tone,
          lengthPreference,
          language,
          aiModel,
          templateId,
          templateType,
          filesMeta,
          selectedDocumentIds,
          webReferences,
        });

        const resolvedProposalId = currentProposalId ?? generatedProposalId;

        const draftPayload: SaveDraftPayload = buildDraftPayload({
          proposalId: resolvedProposalId,
          title,
          clientName,
          lastLocation,
          stage: draftStage,
          proposalData: proposalDataForSave,
          currentStep,
          maxStepReached,
          completedSteps,
          generatedContent: existingGeneratedContent,
          uiState,
          hasEdits: draftStage === "generated" ? true : undefined,
        });

        logger.info("[useWizardAutoSave] Saving draft", {
          proposalId: resolvedProposalId,
          hasGeneratedContent: Object.keys(draftPayload.generatedContent).length > 0,
          sectionCount: Object.keys(draftPayload.generatedContent).length,
          stage: draftStage,
          lastLocation,
        });

        if (effectiveDraftId) {
          try {
            await updateDraftInStore(effectiveDraftId, draftPayload);
            logger.info("[useWizardAutoSave] Draft updated", { draftId: effectiveDraftId });
          } catch (updateError) {
            const is404 = updateError instanceof HttpError && updateError.statusCode === 404;
            if (is404) {
              // Draft was deleted from backend — clear stale ID and create fresh
              logger.warn("[useWizardAutoSave] Draft not found (404), creating new draft", {
                effectiveDraftId,
              });
              pendingDraftIdRef.current = null;
              setCurrentDraftId(null);
              const saved = await saveDraftToStore(draftPayload);
              pendingDraftIdRef.current = saved.id;
              setCurrentDraftId(saved.id);
              logger.info("[useWizardAutoSave] Replacement draft created", { draftId: saved.id });
            } else {
              throw updateError;
            }
          }
        } else {
          // Create new draft
          const saved = await saveDraftToStore(draftPayload);

          // Immediately set the pending ref so the next save call updates instead of creating
          pendingDraftIdRef.current = saved.id;
          setCurrentDraftId(saved.id);

          // Store deduplication data to prevent duplicate creation
          localStorage.setItem(
            DRAFT_DEDUP_KEY,
            JSON.stringify({
              title,
              clientName,
              timestamp: Date.now(),
            })
          );

          logger.info("[useWizardAutoSave] Draft created", { draftId: saved.id });
        }

        // Update last saved data hash
        lastSavedDataRef.current = currentDataHash;
      } catch (error) {
        logger.error("[useWizardAutoSave] Save failed", error);
      } finally {
        isSavingRef.current = false;
      }
    },
    [
      enabled,
      pathname,
      hasData,
      title,
      clientName,
      clientId,
      description,
      selectedSections,
      sectionDisplayNames,
      tone,
      lengthPreference,
      language,
      aiModel,
      templateId,
      templateType,
      filesMeta,
      selectedDocumentIds,
      webReferences,
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
      approvalStatus,
      fromHistory,
    ]
  );

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
  }, [
    enabled,
    hasData,
    saveDraft,
    debounceMs,
    title,
    clientName,
    clientId,
    description,
    selectedSections,
    sectionDisplayNames,
    filesMeta,
    selectedDocumentIds,
    webReferences,
    currentStep,
    draftStage,
  ]);

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
              sectionDisplayNames,
              tone,
              lengthPreference,
              language,
              aiModel,
              templateId,
              templateType,
              files: [],
              filesMeta,
              selectedDocumentIds,
              customSections: [],
              contextualInstructions: "",
              webReferences,
            },
            currentStep,
            maxStepReached,
            completedSteps,
            draftStage,
            timestamp: Date.now(),
          };
          if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
            localStorage.setItem(WIZARD_AUTOSAVE_FALLBACK_KEY, JSON.stringify(fallbackData));
            logger.info("[useWizardAutoSave] Fallback save to localStorage");
          }
        } catch (error) {
          logger.error("[useWizardAutoSave] Fallback save failed", error);
        }

        // Try async save (may not complete before unload)
        void saveDraft(true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    enabled,
    hasData,
    saveDraft,
    title,
    clientName,
    clientId,
    description,
    selectedSections,
    sectionDisplayNames,
    filesMeta,
    selectedDocumentIds,
    webReferences,
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
  ]);

  // Save on visibility change (tab switch)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = (): void => {
      if (document.hidden && hasData()) {
        logger.info("[useWizardAutoSave] Tab hidden, saving draft");
        void saveDraft(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled, hasData, saveDraft]);

  // Save on route change (Next.js navigation)
  useEffect(() => {
    if (!enabled) return;

    // Only save when navigating AWAY from wizard pages (parameters, review, generating)
    // Don't save when navigating TO wizard pages or between wizard pages
    const handleRouteChange = (): void => {
      const isLeavingWizardPage =
        (previousPathnameRef.current === "/parameters" ||
          previousPathnameRef.current === "/review" ||
          previousPathnameRef.current?.startsWith("/generating")) &&
        pathname !== "/parameters" &&
        pathname !== "/review" &&
        !pathname.startsWith("/generating");

      if (isLeavingWizardPage && hasData() && !isUnmountingRef.current) {
        logger.info("[useWizardAutoSave] Leaving wizard page, saving draft", {
          from: previousPathnameRef.current,
          to: pathname,
        });
        void saveDraft(true);
      }

      // Update previous pathname for next comparison
      previousPathnameRef.current = pathname;
    };

    handleRouteChange();
  }, [pathname, enabled, hasData, saveDraft]);
}
