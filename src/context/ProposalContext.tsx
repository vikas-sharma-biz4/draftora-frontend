"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

import type { ProposalData, WizardStep } from "@/types/proposal.types";
import type { DraftStage } from "@/types/draft.types";
import { AI_MODEL_DEFAULT, DEFAULT_SELECTED_SECTIONS } from "@/constants";

interface ProposalContextType {
  proposalData: ProposalData;
  updateProposalData: (updates: Partial<ProposalData>) => void;
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  generatedProposalId: number | null;
  setGeneratedProposalId: (id: number | null) => void;
  currentProposalId: number | null;
  setCurrentProposalId: (id: number | null) => void;
  resetProposal: () => void;
  hydrated: boolean;
  editMode: boolean;
  setEditMode: (val: boolean) => void;
  maxStepReached: WizardStep;
  setMaxStepReached: (step: WizardStep) => void;
  draftStage: DraftStage;
  setDraftStage: (stage: DraftStage) => void;
  completedSteps: number[];
  setCompletedSteps: (steps: number[]) => void;
  markStepCompleted: (stepId: number) => void;
}

const STORAGE_KEY = "draftora_wizard_v1";

const defaultProposalData: ProposalData = {
  title: "",
  clientName: "",
  description: "",
  tone: "professional",
  lengthPreference: "balanced",
  language: "English - US",
  aiModel: AI_MODEL_DEFAULT,
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

const ProposalContext = createContext<ProposalContextType | undefined>(
  undefined
);

export function ProposalProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [proposalData, setProposalData] =
    useState<ProposalData>(defaultProposalData);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedProposalId, setGeneratedProposalId] = useState<number | null>(
    null
  );
  const [currentProposalId, setCurrentProposalId] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [maxStepReached, setMaxStepReached] = useState<WizardStep>(1);
  const [draftStage, setDraftStage] = useState<DraftStage>("template_selection");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Rehydrate from localStorage on mount (client only)
  useEffect(() => {
    try {
      // Migrate data from old branding key if new key is not yet populated
      const OLD_STORAGE_KEY = "proposely_wizard_v1";
      if (!localStorage.getItem(STORAGE_KEY)) {
        const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
        if (oldRaw) {
          localStorage.setItem(STORAGE_KEY, oldRaw);
          localStorage.removeItem(OLD_STORAGE_KEY);
        }
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          proposalData?: Partial<ProposalData>;
          currentStep?: WizardStep;
          draftStage?: DraftStage;
          completedSteps?: number[];
        };
        if (saved.proposalData) {
          setProposalData({
            ...defaultProposalData,
            ...saved.proposalData,
            files: [], // File objects can't be serialized — cleared on refresh
            filesMeta: saved.proposalData.filesMeta ?? [], // metadata IS serializable
          });
        }
        if (saved.currentStep) {
          setCurrentStep(saved.currentStep);
        }
        if (saved.draftStage) {
          setDraftStage(saved.draftStage);
        }
        if (saved.completedSteps) {
          setCompletedSteps(saved.completedSteps);
        }
      }
    } catch {
      // Ignore corrupt/missing storage
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage whenever state changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const toSave = {
        proposalData: { ...proposalData, files: [] }, // filesMeta is kept (serializable)
        currentStep,
        draftStage,
        completedSteps,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Ignore storage quota errors
    }
  }, [proposalData, currentStep, hydrated, draftStage, completedSteps]);

  const updateProposalData = useCallback(
    (updates: Partial<ProposalData>): void => {
      setProposalData((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const markStepCompleted = useCallback((stepId: number): void => {
    setCompletedSteps((prev) => {
      if (prev.includes(stepId)) return prev;
      return [...prev, stepId];
    });
  }, []);

  const resetProposal = useCallback((): void => {
    setProposalData(defaultProposalData);
    setCurrentStep(1);
    setIsGenerating(false);
    setGeneratedProposalId(null);
    setCurrentProposalId(null);
    setEditMode(false);
    setMaxStepReached(1);
    setDraftStage("template_selection");
    setCompletedSteps([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return (
    <ProposalContext.Provider
      value={{
        proposalData,
        updateProposalData,
        currentStep,
        setCurrentStep,
        isGenerating,
        setIsGenerating,
        generatedProposalId,
        setGeneratedProposalId,
        currentProposalId,
        setCurrentProposalId,
        resetProposal,
        hydrated,
        editMode,
        setEditMode,
        maxStepReached,
        setMaxStepReached,
        draftStage,
        setDraftStage,
        completedSteps,
        setCompletedSteps,
        markStepCompleted,
      }}
    >
      {children}
    </ProposalContext.Provider>
  );
}

export function useProposal(): ProposalContextType {
  const ctx = useContext(ProposalContext);
  if (!ctx) {
    throw new Error("useProposal must be used within a ProposalProvider");
  }
  return ctx;
}
