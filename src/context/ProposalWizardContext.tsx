"use client";

import React, { useEffect } from "react";

import type { ProposalData, WizardStep } from "@/interfaces/proposalInterfaces";
import { PROPOSAL_WIZARD_STORAGE_KEY } from "@/constants";
import { logger } from "@/utils/logger";
import {
  useProposalWizardStore,
  DEFAULT_PROPOSAL_DATA,
} from "@/store/features/wizard/proposalWizardSlice";

interface ProposalWizardContextType {
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
  shouldStartBackgroundFetch: boolean;
  setShouldStartBackgroundFetch: (val: boolean) => void;
}

/**
 * ProposalWizardProvider — thin hydration wrapper around the Zustand wizard store.
 *
 * Responsibilities:
 *   1. Hydrate wizard state from localStorage on mount.
 *   2. Auto-persist proposalData + currentStep back to localStorage (debounced).
 *
 * State is no longer held in React Context — useProposalWizardStore is the source
 * of truth, which allows components to subscribe selectively and avoid cascade
 * re-renders triggered by unrelated state changes.
 */
export function ProposalWizardProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const hydrated = useProposalWizardStore((s) => s.hydrated);
  const proposalData = useProposalWizardStore((s) => s.proposalData);
  const currentStep = useProposalWizardStore((s) => s.currentStep);

  // Hydrate from localStorage on mount — read store actions via getState() to
  // avoid subscribing to state and causing an extra re-render cycle.
  useEffect(() => {
    const { updateProposalData, setCurrentStep, setHydrated } =
      useProposalWizardStore.getState();
    try {
      const raw = localStorage.getItem(PROPOSAL_WIZARD_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          proposalData?: Partial<ProposalData>;
          currentStep?: WizardStep;
        };
        if (saved.proposalData) {
          updateProposalData({
            ...DEFAULT_PROPOSAL_DATA,
            ...saved.proposalData,
            files: [],
            filesMeta: saved.proposalData.filesMeta ?? [],
          });
        }
        if (saved.currentStep) {
          setCurrentStep(saved.currentStep);
        }
      }
    } catch (err) {
      logger.warn("[ProposalWizardProvider] Failed to restore draft from localStorage:", err);
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-persist to localStorage with 500 ms debounce.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        const toSave = {
          proposalData: { ...proposalData, files: [] },
          currentStep,
        };
        localStorage.setItem(PROPOSAL_WIZARD_STORAGE_KEY, JSON.stringify(toSave));
      } catch (err) {
        logger.warn("[ProposalWizardProvider] Failed to persist draft to localStorage:", err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [proposalData, currentStep, hydrated]);

  return <>{children}</>;
}

/**
 * useProposalWizard — returns wizard state and actions from the Zustand store.
 *
 * Components subscribing to this hook re-render only when wizard state changes,
 * not when unrelated siblings update their own stores.
 */
export function useProposalWizard(): ProposalWizardContextType {
  return useProposalWizardStore();
}
