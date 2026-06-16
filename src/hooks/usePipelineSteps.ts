/**
 * Hook for managing pipeline step navigation and access control
 *
 * Handles:
 * - Tracking visited pipeline steps (persisted via Zustand store)
 * - Determining highest visited step
 * - Syncing step state with backend
 * - Validating step access permissions
 */

import { useCallback } from "react";
import {
  getProposalStatus,
  markProposalStepVisited,
  validateProposalStepAccess,
} from "@/services/proposal";
import { logger } from "@/utils/logger";
import { usePipelineStore } from "@/store/features/pipeline/pipelineSlice";

interface UsePipelineStepsReturn {
  visitedPipelineSteps: number[];
  highestVisitedStep: number | null;
  setVisitedPipelineSteps: (steps: number[]) => void;
  setHighestVisitedStep: (step: number | null) => void;
  syncVisitedStepsFromBackend: (proposalId: number) => Promise<void>;
  markStepVisitedOnBackend: (proposalId: number, stepId: number) => Promise<void>;
  canAccessStep: (proposalId: number, stepId: number) => Promise<boolean>;
  resetPipelineSteps: () => void;
}

export function usePipelineSteps(): UsePipelineStepsReturn {
  const visitedPipelineSteps = usePipelineStore((state) => state.visitedSteps);
  const setVisitedSteps = usePipelineStore((state) => state.setVisitedSteps);
  const markStepAsVisited = usePipelineStore((state) => state.markStepAsVisited);
  const resetVisitedSteps = usePipelineStore((state) => state.resetVisitedSteps);

  // Calculate highest visited step from the array
  const highestVisitedStep =
    visitedPipelineSteps.length > 0 ? Math.max(...visitedPipelineSteps) : null;

  const syncVisitedStepsFromBackend = useCallback(
    async (proposalId: number): Promise<void> => {
      try {
        const status = await getProposalStatus(proposalId);
        // Merge backend steps with local steps to preserve locally-visited steps
        const localSteps = visitedPipelineSteps;
        const backendSteps = status.visitedPipelineSteps || [];
        const mergedSteps = Array.from(new Set([...localSteps, ...backendSteps])).sort(
          (a, b) => a - b
        );
        setVisitedSteps(mergedSteps);
      } catch (error) {
        logger.error("[usePipelineSteps] Failed to sync visited steps:", error);
      }
    },
    [setVisitedSteps]
  );

  const markStepVisitedOnBackend = useCallback(
    async (proposalId: number, stepId: number): Promise<void> => {
      try {
        await markProposalStepVisited(proposalId, stepId);
        markStepAsVisited(stepId);
      } catch (error) {
        logger.error("[usePipelineSteps] Failed to mark step visited:", error);
      }
    },
    [markStepAsVisited]
  );

  const canAccessStep = useCallback(
    async (proposalId: number, stepId: number): Promise<boolean> => {
      try {
        return await validateProposalStepAccess(proposalId, stepId);
      } catch (error) {
        logger.error("[usePipelineSteps] Failed to validate step access:", error);
        return false;
      }
    },
    []
  );

  const resetPipelineSteps = useCallback((): void => {
    resetVisitedSteps();
  }, [resetVisitedSteps]);

  return {
    visitedPipelineSteps,
    highestVisitedStep,
    setVisitedPipelineSteps: setVisitedSteps,
    setHighestVisitedStep: () => {
      // No-op - highestVisitedStep is derived from visitedPipelineSteps
      logger.warn(
        "[usePipelineSteps] setHighestVisitedStep is deprecated - highest is derived from visitedSteps"
      );
    },
    syncVisitedStepsFromBackend,
    markStepVisitedOnBackend,
    canAccessStep,
    resetPipelineSteps,
  };
}
