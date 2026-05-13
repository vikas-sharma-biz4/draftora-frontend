/**
 * Zustand store for proposal wizard state
 *
 * Migrated from ProposalWizardContext (React Context) to Zustand to allow
 * selective subscriptions. Components not calling useProposalWizard() are
 * no longer re-rendered when wizard state changes — only direct subscribers
 * are affected, eliminating the cascade re-render caused by React Context.
 *
 * ProposalWizardProvider in ProposalWizardContext.tsx is retained as a thin
 * hydration wrapper (localStorage read/write on mount). The context itself
 * is no longer the source of truth — this store is.
 */

import { create } from "zustand";

import { DEFAULT_AI_MODEL } from "@/config/config";
import { DEFAULT_SELECTED_SECTIONS, PROPOSAL_WIZARD_STORAGE_KEY } from "@/constants";
import type { ProposalData, WizardStep } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";

export const DEFAULT_PROPOSAL_DATA: ProposalData = {
  title: "",
  clientName: "",
  clientId: undefined,
  description: "",
  tone: "professional",
  lengthPreference: "balanced",
  language: "English - US",
  aiModel: DEFAULT_AI_MODEL,
  selectedSections: [...DEFAULT_SELECTED_SECTIONS],
  sectionDisplayNames: {},
  customSections: [],
  contextualInstructions: "",
  webReferences: [],
  files: [],
  filesMeta: [],
  templateId: null,
  templateType: "scratch",
};

export const INITIAL_WIZARD_STATE = {
  proposalData: DEFAULT_PROPOSAL_DATA,
  currentStep: 1 as WizardStep,
  isGenerating: false,
  generatedProposalId: null as number | null,
  currentProposalId: null as number | null,
  hydrated: false,
  editMode: false,
  maxStepReached: 1 as WizardStep,
  shouldStartBackgroundFetch: false,
};

interface ProposalWizardState {
  proposalData: ProposalData;
  currentStep: WizardStep;
  isGenerating: boolean;
  generatedProposalId: number | null;
  currentProposalId: number | null;
  hydrated: boolean;
  editMode: boolean;
  maxStepReached: WizardStep;
  shouldStartBackgroundFetch: boolean;

  updateProposalData: (updates: Partial<ProposalData>) => void;
  setCurrentStep: (step: WizardStep) => void;
  setIsGenerating: (val: boolean) => void;
  setGeneratedProposalId: (id: number | null) => void;
  setCurrentProposalId: (id: number | null) => void;
  setHydrated: (val: boolean) => void;
  setEditMode: (val: boolean) => void;
  setMaxStepReached: (step: WizardStep) => void;
  setShouldStartBackgroundFetch: (val: boolean) => void;
  resetProposal: () => void;
  reset: () => void;
}

export const useProposalWizardStore = create<ProposalWizardState>((set) => ({
  ...INITIAL_WIZARD_STATE,

  updateProposalData: (updates: Partial<ProposalData>): void => {
    set((state) => {
      const newProposalData = { ...state.proposalData, ...updates };
      logger.debug('[proposalWizardSlice] updateProposalData', { updates, newProposalData });
      return { proposalData: newProposalData };
    });
  },

  setCurrentStep: (step: WizardStep): void => {
    set({ currentStep: step });
  },

  setIsGenerating: (val: boolean): void => {
    set({ isGenerating: val });
  },

  setGeneratedProposalId: (id: number | null): void => {
    set({ generatedProposalId: id });
  },

  setCurrentProposalId: (id: number | null): void => {
    set({ currentProposalId: id });
  },

  setHydrated: (val: boolean): void => {
    set({ hydrated: val });
  },

  setEditMode: (val: boolean): void => {
    set({ editMode: val });
  },

  setMaxStepReached: (step: WizardStep): void => {
    set({ maxStepReached: step });
  },

  setShouldStartBackgroundFetch: (val: boolean): void => {
    set({ shouldStartBackgroundFetch: val });
  },

  resetProposal: (): void => {
    set(INITIAL_WIZARD_STATE);
    try {
      localStorage.removeItem(PROPOSAL_WIZARD_STORAGE_KEY);
    } catch (e) {
      logger.warn("[proposalWizardSlice] Failed to clear wizard storage", e);
    }
  },

  reset: (): void => {
    set(INITIAL_WIZARD_STATE);
  },
}));
