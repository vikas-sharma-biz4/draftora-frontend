"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { DEFAULT_SELECTED_SECTIONS } from "@/constants";
import type { ProposalData, WizardStep } from "@/types/proposal.types";

interface ProposalContextType {
  proposalData: ProposalData;
  updateProposalData: (updates: Partial<ProposalData>) => void;
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  generatedProposalId: number | null;
  setGeneratedProposalId: (id: number | null) => void;
  resetProposal: () => void;
  hydrated: boolean;
}

const STORAGE_KEY = "proposely_wizard_v1";

const defaultProposalData: ProposalData = {
  title: "",
  clientName: "",
  description: "",
  tone: "professional",
  lengthPreference: "balanced",
  language: "English - US",
  selectedSections: [...DEFAULT_SELECTED_SECTIONS],
  sectionDisplayNames: {},
  customSections: [],
  contextualInstructions: "",
  webReferences: [],
  files: [],
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
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Rehydrate from localStorage on mount (client only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          proposalData?: Partial<ProposalData>;
          currentStep?: WizardStep;
        };
        if (saved.proposalData) {
          setProposalData({
            ...defaultProposalData,
            ...saved.proposalData,
            files: [], // File objects can't be serialized — cleared on refresh
          });
        }
        if (saved.currentStep) {
          setCurrentStep(saved.currentStep);
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
        proposalData: { ...proposalData, files: [] },
        currentStep,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Ignore storage quota errors
    }
  }, [proposalData, currentStep, hydrated]);

  const updateProposalData = useCallback(
    (updates: Partial<ProposalData>): void => {
      setProposalData((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const resetProposal = useCallback((): void => {
    setProposalData(defaultProposalData);
    setCurrentStep(1);
    setIsGenerating(false);
    setGeneratedProposalId(null);
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
        resetProposal,
        hydrated,
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
