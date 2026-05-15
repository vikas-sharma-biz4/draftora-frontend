/**
 * Zustand store for current draft session state
 *
 * Manages the active draft session lifecycle:
 * - Current draft ID (links session to a saved draft)
 * - Draft stage tracking (template_selection → parameters_complete → review_complete → generated)
 * - Completed wizard steps
 * - Auto-save toggle
 *
 * This store is intentionally separated from the draft list store
 * (useDraftStore) to prevent list re-fetches from triggering
 * re-renders in components that only care about session state.
 */

import { create } from 'zustand';
import type { DraftStage } from '@/interfaces/draftInterfaces';

export const INITIAL_DRAFT_SESSION_STATE = {
  currentDraftId: null as string | null,
  autoSaveEnabled: true,
  draftStage: "template_selection" as DraftStage,
  completedSteps: [] as number[],
  isSaving: false as boolean,
};

interface DraftSessionState {
  currentDraftId: string | null;
  autoSaveEnabled: boolean;
  draftStage: DraftStage;
  completedSteps: number[];
  isSaving: boolean;

  setCurrentDraftId: (id: string | null) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setDraftStage: (stage: DraftStage) => void;
  setCompletedSteps: (steps: number[]) => void;
  markStepCompleted: (stepId: number) => void;
  setIsSaving: (saving: boolean) => void;
  resetDraftSession: () => void;
  reset: () => void;
}

export const useDraftSessionStore = create<DraftSessionState>((set) => ({
  currentDraftId: null,
  autoSaveEnabled: true,
  draftStage: "template_selection",
  completedSteps: [],
  isSaving: false,

  setCurrentDraftId: (id: string | null) => {
    set({ currentDraftId: id });
  },

  setAutoSaveEnabled: (enabled: boolean) => {
    set({ autoSaveEnabled: enabled });
  },

  setDraftStage: (stage: DraftStage) => {
    set({ draftStage: stage });
  },

  setCompletedSteps: (steps: number[]) => {
    set({ completedSteps: steps });
  },

  markStepCompleted: (stepId: number) => {
    set(state => {
      const currentSteps = state.completedSteps || [];
      return {
        completedSteps: currentSteps.includes(stepId)
          ? currentSteps
          : [...currentSteps, stepId],
      };
    });
  },

  setIsSaving: (saving: boolean) => {
    set({ isSaving: saving });
  },

  resetDraftSession: () => {
    set(INITIAL_DRAFT_SESSION_STATE);
  },

  reset: () => set(INITIAL_DRAFT_SESSION_STATE),
}));
