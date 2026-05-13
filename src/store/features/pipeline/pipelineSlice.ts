/**
 * Zustand store for pipeline state management
 *
 * Migrated from ProposalPipelineContext (React Context) to Zustand to allow
 * selective subscriptions. Components not calling pipeline selector hooks are
 * no longer re-rendered when pipeline state changes — only direct subscribers
 * are affected, eliminating the cascade re-render caused by React Context.
 *
 * The usePipelineSteps hook logic has been integrated into this slice for
 * centralized state management with backend synchronization capabilities.
 */

import { create } from "zustand";
import {
  getProposalStatus,
  markProposalStepVisited,
  validateProposalStepAccess,
} from "@/services/proposal.service";
import { logger } from "@/utils/logger";

export const INITIAL_PIPELINE_STATE = {
  visitedPipelineSteps: [] as number[],
  highestVisitedStep: null as number | null,
};

interface PipelineState {
  visitedPipelineSteps: number[];
  highestVisitedStep: number | null;

  setVisitedPipelineSteps: (steps: number[]) => void;
  setHighestVisitedStep: (step: number | null) => void;
  syncVisitedStepsFromBackend: (proposalId: number) => Promise<void>;
  markStepVisitedOnBackend: (proposalId: number, stepId: number) => Promise<void>;
  canAccessStep: (proposalId: number, stepId: number) => Promise<boolean>;
  resetPipeline: () => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  ...INITIAL_PIPELINE_STATE,

  setVisitedPipelineSteps: (steps: number[]): void => {
    set({ visitedPipelineSteps: steps });
  },

  setHighestVisitedStep: (step: number | null): void => {
    set({ highestVisitedStep: step });
  },

  syncVisitedStepsFromBackend: async (proposalId: number): Promise<void> => {
    try {
      const status = await getProposalStatus(proposalId);
      set({
        visitedPipelineSteps: status.visitedPipelineSteps,
        highestVisitedStep: status.highestVisitedStep,
      });
      logger.debug('[pipelineSlice] Synced visited steps from backend', {
        proposalId,
        visitedSteps: status.visitedPipelineSteps,
        highestStep: status.highestVisitedStep,
      });
    } catch (error) {
      logger.error('[pipelineSlice] Failed to sync visited steps:', error);
    }
  },

  markStepVisitedOnBackend: async (proposalId: number, stepId: number): Promise<void> => {
    try {
      await markProposalStepVisited(proposalId, stepId);
      set((state) => {
        // Avoid duplicates and maintain sorted order
        if (state.visitedPipelineSteps.includes(stepId)) {
          return state;
        }
        const newVisitedSteps = [...state.visitedPipelineSteps, stepId].sort((a, b) => a - b);
        const newHighestStep =
          state.highestVisitedStep === null || stepId > state.highestVisitedStep
            ? stepId
            : state.highestVisitedStep;
        logger.debug('[pipelineSlice] Marked step visited', {
          proposalId,
          stepId,
          newVisitedSteps,
          newHighestStep,
        });
        return {
          visitedPipelineSteps: newVisitedSteps,
          highestVisitedStep: newHighestStep,
        };
      });
    } catch (error) {
      logger.error('[pipelineSlice] Failed to mark step visited:', error);
    }
  },

  canAccessStep: async (proposalId: number, stepId: number): Promise<boolean> => {
    try {
      return await validateProposalStepAccess(proposalId, stepId);
    } catch (error) {
      logger.error('[pipelineSlice] Failed to validate step access:', error);
      return false;
    }
  },

  resetPipeline: (): void => {
    set(INITIAL_PIPELINE_STATE);
    logger.debug('[pipelineSlice] Pipeline state reset');
  },

  reset: (): void => {
    set(INITIAL_PIPELINE_STATE);
  },
}));

// ─── Granular Selector Hooks ─────────────────────────────────────────────────────

/**
 * Selector hooks for fine-grained Zustand subscriptions.
 *
 * Components should use these hooks to subscribe only to the specific state
 * they need, avoiding unnecessary re-renders when unrelated state changes.
 */

/**
 * Selects the visited pipeline steps array.
 */
export const useVisitedPipelineSteps = () =>
  usePipelineStore((state) => state.visitedPipelineSteps);

/**
 * Selects the highest visited step.
 */
export const useHighestVisitedStep = () =>
  usePipelineStore((state) => state.highestVisitedStep);

/**
 * Selects all pipeline actions (stable reference).
 * Use this when you need multiple actions without subscribing to state changes.
 */
export const usePipelineActions = () =>
  usePipelineStore((state) => ({
    setVisitedPipelineSteps: state.setVisitedPipelineSteps,
    setHighestVisitedStep: state.setHighestVisitedStep,
    syncVisitedStepsFromBackend: state.syncVisitedStepsFromBackend,
    markStepVisitedOnBackend: state.markStepVisitedOnBackend,
    canAccessStep: state.canAccessStep,
    resetPipeline: state.resetPipeline,
    reset: state.reset,
  }));
