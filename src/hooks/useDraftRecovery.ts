import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getDraft } from "@/services/draft.service";
import { useProposalWizard, useProposalPipeline, useProposalDraftSession } from "@/context/ProposalContext";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import type { SavedDraft, DraftMetadata } from "@/interfaces/draftInterfaces";

interface UseDraftRecoveryOptions {
  autoRecover?: boolean;
  onRecoveryComplete?: () => void;
  onRecoveryError?: (error: Error) => void;
}

export function useDraftRecovery(options: UseDraftRecoveryOptions = {}): {
  availableDrafts: DraftMetadata[];
  isLoadingDrafts: boolean;
  recoverDraft: (draftId: string) => Promise<void>;
  isRecovering: boolean;
  recoveryError: Error | null;
} {
  const { autoRecover = false, onRecoveryComplete, onRecoveryError } = options;

  const router = useRouter();
  const {
    updateProposalData,
    setCurrentStep,
    setMaxStepReached,
    setGeneratedProposalId,
  } = useProposalWizard();

  const setCompletedSteps = useDraftSessionStore(state => state.setCompletedSteps);
  const setDraftStage = useDraftSessionStore(state => state.setDraftStage);

  // Use draft store for centralized draft list management
  const drafts = useDraftStore(state => state.drafts);
  const isLoadingDrafts = useDraftStore(state => state.isLoading);
  const fetchDrafts = useDraftStore(state => state.fetchDrafts);

  const hasAutoRecoveredRef = useRef(false);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<Error | null>(null);

  // Load drafts from store on mount
  useEffect(() => {
    fetchDrafts().catch((error) => {
      const err = error instanceof Error ? error : new Error("Failed to load drafts");
      setRecoveryError(err);
    });
  }, [fetchDrafts]);

  const recoverDraft = useCallback(
    async (draftId: string): Promise<void> => {
      try {
        setIsRecovering(true);
        setRecoveryError(null);

        const draft: SavedDraft = await getDraft(draftId);

        updateProposalData(draft.wizardState.proposalData);
        setCurrentStep(draft.wizardState.currentStep);
        setMaxStepReached(draft.wizardState.maxStepReached);
        setCompletedSteps(draft.wizardState.completedSteps);
        setDraftStage(draft.stage);

        if (draft.proposalId) {
          setGeneratedProposalId(draft.proposalId);
        }

        switch (draft.lastLocation) {
          case "wizard_parameters":
            router.push("/parameters");
            break;
          case "wizard_review":
            router.push("/review");
            break;
          case "web_view":
            if (draft.proposalId) {
              router.push(`/proposal/${draft.proposalId}`);
            } else {
              router.push("/parameters");
            }
            break;
          case "ai_sections":
            router.push("/generating");
            break;
          default:
            router.push("/parameters");
        }

        if (draft.uiState.scrollPosition > 0) {
          setTimeout(() => {
            window.scrollTo({
              top: draft.uiState.scrollPosition,
              behavior: "smooth",
            });
          }, 300);
        }

        onRecoveryComplete?.();
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error("Failed to recover draft");
        setRecoveryError(err);
        onRecoveryError?.(err);
      } finally {
        setIsRecovering(false);
      }
    },
    [
      updateProposalData,
      setCurrentStep,
      setMaxStepReached,
      setGeneratedProposalId,
      setCompletedSteps,
      setDraftStage,
      router,
      onRecoveryComplete,
      onRecoveryError,
    ]
  );

  useEffect(() => {
    if (autoRecover && drafts.length > 0 && !hasAutoRecoveredRef.current) {
      hasAutoRecoveredRef.current = true;
      const mostRecent = [...drafts].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      recoverDraft(mostRecent.id);
    }
  }, [autoRecover, drafts, recoverDraft]);

  return {
    availableDrafts: drafts,
    isLoadingDrafts,
    recoverDraft,
    isRecovering,
    recoveryError,
  };
}
