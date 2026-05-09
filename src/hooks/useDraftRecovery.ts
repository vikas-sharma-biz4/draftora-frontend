import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getDraft, listDrafts } from "@/services/draftApi";
import { useProposal } from "@/context/ProposalContext";
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
    setCompletedSteps,
    setDraftStage,
    setGeneratedProposalId,
  } = useProposal();

  const [availableDrafts, setAvailableDrafts] = useState<DraftMetadata[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState<boolean>(false);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<Error | null>(null);

  const loadAvailableDrafts = useCallback(async (): Promise<void> => {
    try {
      setIsLoadingDrafts(true);
      const drafts = await listDrafts();
      setAvailableDrafts(drafts);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to load drafts");
      setRecoveryError(err);
    } finally {
      setIsLoadingDrafts(false);
    }
  }, []);

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
          case "WIZARD_PARAMETERS":
            router.push("/parameters");
            break;
          case "WIZARD_REVIEW":
            router.push("/review");
            break;
          case "WEB_VIEW":
            if (draft.proposalId) {
              router.push(`/proposal/${draft.proposalId}`);
            } else {
              router.push("/parameters");
            }
            break;
          case "AI_SECTIONS":
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
      setCompletedSteps,
      setDraftStage,
      setGeneratedProposalId,
      router,
      onRecoveryComplete,
      onRecoveryError,
    ]
  );

  useEffect(() => {
    loadAvailableDrafts();
  }, [loadAvailableDrafts]);

  useEffect(() => {
    if (autoRecover && availableDrafts.length > 0) {
      const mostRecent = availableDrafts.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      recoverDraft(mostRecent.id);
    }
  }, [autoRecover, availableDrafts, recoverDraft]);

  return {
    availableDrafts,
    isLoadingDrafts,
    recoverDraft,
    isRecovering,
    recoveryError,
  };
}
