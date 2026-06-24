/**
 * Zustand store for pipeline step tracking
 *
 * Tracks which pipeline steps the user has visited during the proposal creation flow.
 * This enables progressive navigation where users can go back to previously visited steps
 * but cannot skip ahead to unvisited steps.
 *
 * State is persisted to localStorage to survive page refreshes.
 */

import { create } from "zustand";

const PIPELINE_STORAGE_KEY = "draftora_pipeline_steps";

function loadFromStorage(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PIPELINE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn("[pipelineSlice] Failed to load from localStorage:", err);
  }
  return [];
}

function saveToStorage(steps: number[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(steps));
  } catch (err) {
    console.warn("[pipelineSlice] Failed to save to localStorage:", err);
  }
}

export const INITIAL_PIPELINE_STATE = {
  visitedSteps: loadFromStorage(),
};

interface PipelineState {
  visitedSteps: number[];

  // Actions
  markStepAsVisited: (stepId: number) => void;
  resetVisitedSteps: () => void;
  setVisitedSteps: (steps: number[]) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  ...INITIAL_PIPELINE_STATE,

  markStepAsVisited: (stepId: number): void => {
    set((state) => {
      if (state.visitedSteps.includes(stepId)) {
        return state;
      }
      const newSteps = [...state.visitedSteps, stepId];
      saveToStorage(newSteps);
      return {
        visitedSteps: newSteps,
      };
    });
  },

  setVisitedSteps: (steps: number[]): void => {
    saveToStorage(steps);
    set({ visitedSteps: steps });
  },

  resetVisitedSteps: (): void => {
    saveToStorage([]);
    set(INITIAL_PIPELINE_STATE);
  },

  reset: (): void => {
    saveToStorage([]);
    set(INITIAL_PIPELINE_STATE);
  },
}));

// ─── Selector Hooks ─────────────────────────────────────────────────────

/**
 * Selects the visited pipeline steps array.
 */
export const useVisitedPipelineSteps = () => usePipelineStore((state) => state.visitedSteps);
