import { useEffect, useRef, useCallback } from "react";
import { useProposal } from "@/context/ProposalContext";
import { saveDraft, updateDraft } from "@/services/draftApi";
import type { DraftLocation, SaveDraftPayload } from "@/interfaces/draftInterfaces";

interface UseAutoSaveOptions {
  enabled: boolean;
  debounceMs?: number;
  location: DraftLocation;
  onSaveSuccess?: (draftId: string) => void;
  onSaveError?: (error: Error) => void;
}

const DEFAULT_DEBOUNCE_MS = 2000;

export function useAutoSave(options: UseAutoSaveOptions): {
  saveNow: () => Promise<void>;
  isSaving: boolean;
  lastSaved: Date | null;
} {
  const {
    enabled,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    location,
    onSaveSuccess,
    onSaveError,
  } = options;

  const {
    proposalData,
    currentStep,
    maxStepReached,
    completedSteps,
    draftStage,
    generatedProposalId,
  } = useProposal();

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const lastSavedRef = useRef<Date | null>(null);
  const currentDraftIdRef = useRef<string | null>(null);
  const saveInProgressRef = useRef<boolean>(false);

  const buildPayload = useCallback((): SaveDraftPayload => {
    const status: "draft" | "generating" | "completed" =
      draftStage === "generated" ? "completed" : "draft";

    return {
      proposalId: generatedProposalId,
      title: proposalData.title || "Untitled Proposal",
      clientName: proposalData.clientName || "Unknown Client",
      status,
      lastLocation: location,
      stage: draftStage,
      wizardState: {
        currentStep,
        maxStepReached,
        completedSteps,
        proposalData,
      },
      generatedContent: proposalData.sections || {},
      uiState: {
        scrollPosition: 0,
        activeSection: null,
        expandedSections: [],
        lastVisibleSection: null,
      },
    };
  }, [
    proposalData,
    currentStep,
    maxStepReached,
    completedSteps,
    draftStage,
    location,
    generatedProposalId,
  ]);

  const performSave = useCallback(async (): Promise<void> => {
    if (saveInProgressRef.current) {
      return;
    }

    try {
      saveInProgressRef.current = true;
      isSavingRef.current = true;

      const payload = buildPayload();

      let savedDraft;
      if (currentDraftIdRef.current) {
        savedDraft = await updateDraft(currentDraftIdRef.current, payload);
      } else {
        savedDraft = await saveDraft(payload);
        currentDraftIdRef.current = savedDraft.id;
      }

      lastSavedRef.current = new Date();
      onSaveSuccess?.(savedDraft.id);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown save error");
      onSaveError?.(err);
    } finally {
      isSavingRef.current = false;
      saveInProgressRef.current = false;
    }
  }, [buildPayload, onSaveSuccess, onSaveError]);

  const saveNow = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await performSave();
  }, [performSave]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, debounceMs, performSave, proposalData, currentStep, draftStage]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (isSavingRef.current) {
        e.preventDefault();
        e.returnValue = "";
      } else {
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/drafts/beacon/`,
          JSON.stringify(buildPayload())
        );
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.hidden && !isSavingRef.current) {
        performSave();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, buildPayload, performSave]);

  return {
    saveNow,
    isSaving: isSavingRef.current,
    lastSaved: lastSavedRef.current,
  };
}
