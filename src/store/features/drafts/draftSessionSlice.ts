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

import { create } from "zustand";
import type { DraftStage } from "@/interfaces/draftInterfaces";

const SESSION_DRAFT_ID_KEY = "draftora_current_draft_id";
const SESSION_DRAFT_STAGE_KEY = "draftora_draft_stage";
const SESSION_COMPLETED_STEPS_KEY = "draftora_completed_steps";

const isBrowser = typeof window !== "undefined" && typeof sessionStorage !== "undefined";

function readDraftIdFromSession(): string | null {
  /* istanbul ignore next */
  if (!isBrowser) return null;
  try {
    return sessionStorage.getItem(SESSION_DRAFT_ID_KEY);
  } catch {
    /* istanbul ignore next */
    return null;
  }
}

function writeDraftIdToSession(id: string | null): void {
  /* istanbul ignore next */
  if (!isBrowser) return;
  try {
    if (id) sessionStorage.setItem(SESSION_DRAFT_ID_KEY, id);
    else sessionStorage.removeItem(SESSION_DRAFT_ID_KEY);
  } catch {
    /* ignore */
  }
}

function readDraftStageFromSession(): DraftStage {
  /* istanbul ignore next */
  if (!isBrowser) return "template_selection";
  try {
    return (sessionStorage.getItem(SESSION_DRAFT_STAGE_KEY) as DraftStage) || "template_selection";
  } catch {
    /* istanbul ignore next */
    return "template_selection";
  }
}

function writeDraftStageToSession(stage: DraftStage): void {
  /* istanbul ignore next */
  if (!isBrowser) return;
  try {
    sessionStorage.setItem(SESSION_DRAFT_STAGE_KEY, stage);
  } catch {
    /* ignore */
  }
}

function readCompletedStepsFromSession(): number[] {
  /* istanbul ignore next */
  if (!isBrowser) return [];
  try {
    const raw = sessionStorage.getItem(SESSION_COMPLETED_STEPS_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    /* istanbul ignore next */
    return [];
  }
}

function writeCompletedStepsToSession(steps: number[]): void {
  /* istanbul ignore next */
  if (!isBrowser) return;
  try {
    sessionStorage.setItem(SESSION_COMPLETED_STEPS_KEY, JSON.stringify(steps));
  } catch {
    /* ignore */
  }
}

export const INITIAL_DRAFT_SESSION_STATE = {
  currentDraftId: null as string | null,
  autoSaveEnabled: true,
  draftStage: "template_selection" as DraftStage,
  completedSteps: [] as number[],
  isSaving: false as boolean,
  fromHistory: false as boolean,
  generatedContent: {} as Record<string, string>,
};

const restoredDraftId = readDraftIdFromSession();
const restoredDraftStage = readDraftStageFromSession();
const restoredCompletedSteps = readCompletedStepsFromSession();

interface DraftSessionState {
  currentDraftId: string | null;
  autoSaveEnabled: boolean;
  draftStage: DraftStage;
  completedSteps: number[];
  isSaving: boolean;
  fromHistory: boolean;
  generatedContent: Record<string, string>;

  setCurrentDraftId: (id: string | null) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setDraftStage: (stage: DraftStage) => void;
  setCompletedSteps: (steps: number[]) => void;
  markStepCompleted: (stepId: number) => void;
  setIsSaving: (saving: boolean) => void;
  setFromHistory: (value: boolean) => void;
  setGeneratedContent: (content: Record<string, string>) => void;
  resetDraftSession: () => void;
  reset: () => void;
}

export const useDraftSessionStore = create<DraftSessionState>((set) => ({
  currentDraftId: restoredDraftId,
  autoSaveEnabled: true,
  draftStage: restoredDraftStage,
  completedSteps: restoredCompletedSteps,
  isSaving: false,
  fromHistory: false,
  generatedContent: {},

  setCurrentDraftId: (id: string | null) => {
    writeDraftIdToSession(id);
    set({ currentDraftId: id });
  },

  setAutoSaveEnabled: (enabled: boolean) => {
    set({ autoSaveEnabled: enabled });
  },

  setDraftStage: (stage: DraftStage) => {
    writeDraftStageToSession(stage);
    set({ draftStage: stage });
  },

  setCompletedSteps: (steps: number[]) => {
    writeCompletedStepsToSession(steps);
    set({ completedSteps: steps });
  },

  markStepCompleted: (stepId: number) => {
    set((state) => {
      const currentSteps = state.completedSteps || [];
      const newSteps = currentSteps.includes(stepId) ? currentSteps : [...currentSteps, stepId];
      writeCompletedStepsToSession(newSteps);
      return { completedSteps: newSteps };
    });
  },

  setIsSaving: (saving: boolean) => {
    set({ isSaving: saving });
  },

  setFromHistory: (value: boolean) => {
    set({ fromHistory: value });
  },

  setGeneratedContent: (content: Record<string, string>) => {
    set({ generatedContent: content });
  },

  resetDraftSession: () => {
    writeDraftIdToSession(null);
    writeDraftStageToSession("template_selection");
    writeCompletedStepsToSession([]);
    set(INITIAL_DRAFT_SESSION_STATE);
  },

  reset: () => {
    writeDraftIdToSession(null);
    writeDraftStageToSession("template_selection");
    writeCompletedStepsToSession([]);
    set(INITIAL_DRAFT_SESSION_STATE);
  },
}));
