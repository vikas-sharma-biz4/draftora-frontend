/**
 * Hook for managing pipeline step navigation and access control
 * 
 * Handles:
 * - Tracking visited pipeline steps
 * - Determining highest visited step
 * - Syncing step state with backend
 * - Validating step access permissions
 */

import { useState, useCallback } from 'react';
import {
  getProposalStatus,
  markProposalStepVisited,
  validateProposalStepAccess,
} from '@/services/proposal.service';
import { logger } from '@/utils/logger';

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
  const [visitedPipelineSteps, setVisitedPipelineSteps] = useState<number[]>([]);
  const [highestVisitedStep, setHighestVisitedStep] = useState<number | null>(null);

  const syncVisitedStepsFromBackend = useCallback(async (proposalId: number): Promise<void> => {
    try {
      const status = await getProposalStatus(proposalId);
      setVisitedPipelineSteps(status.visitedPipelineSteps);
      setHighestVisitedStep(status.highestVisitedStep);
    } catch (error) {
      logger.error('[usePipelineSteps] Failed to sync visited steps:', error);
    }
  }, []);

  const markStepVisitedOnBackend = useCallback(async (proposalId: number, stepId: number): Promise<void> => {
    try {
      await markProposalStepVisited(proposalId, stepId);
      setVisitedPipelineSteps((prev) => {
        if (prev.includes(stepId)) return prev;
        return [...prev, stepId].sort((a, b) => a - b);
      });
      setHighestVisitedStep((prev) => {
        if (prev === null || stepId > prev) return stepId;
        return prev;
      });
    } catch (error) {
      logger.error('[usePipelineSteps] Failed to mark step visited:', error);
    }
  }, []);

  const canAccessStep = useCallback(async (proposalId: number, stepId: number): Promise<boolean> => {
    try {
      return await validateProposalStepAccess(proposalId, stepId);
    } catch (error) {
      logger.error('[usePipelineSteps] Failed to validate step access:', error);
      return false;
    }
  }, []);

  const resetPipelineSteps = useCallback((): void => {
    setVisitedPipelineSteps([]);
    setHighestVisitedStep(null);
  }, []);

  return {
    visitedPipelineSteps,
    highestVisitedStep,
    setVisitedPipelineSteps,
    setHighestVisitedStep,
    syncVisitedStepsFromBackend,
    markStepVisitedOnBackend,
    canAccessStep,
    resetPipelineSteps,
  };
}
