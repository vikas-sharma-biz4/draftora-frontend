/**
 * Zustand store for pipeline step tracking
 *
 * Tracks which pipeline steps the user has visited during the proposal creation flow.
 * This enables progressive navigation where users can go back to previously visited steps
 * but cannot skip ahead to unvisited steps.
 */

import { create } from "zustand";

export const INITIAL_PIPELINE_STATE = {
  visitedSteps: [] as number[],
};

interface PipelineState {
  visitedSteps: number[];

  // Actions
  markStepAsVisited: (stepId: number) => void;
  resetVisitedSteps: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  ...INITIAL_PIPELINE_STATE,

  markStepAsVisited: (stepId: number): void => {
    set((state) => {
      if (state.visitedSteps.includes(stepId)) {
        return state;
      }
      return {
        visitedSteps: [...state.visitedSteps, stepId],
      };
    });
  },

  resetVisitedSteps: (): void => {
    set(INITIAL_PIPELINE_STATE);
  },
}));

// ─── Selector Hooks ─────────────────────────────────────────────────────

/**
 * Selects the visited pipeline steps array.
 */
export const useVisitedPipelineSteps = () =>
  usePipelineStore((state) => state.visitedSteps);
