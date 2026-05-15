"use client";

import React, { useEffect } from "react";

import type { ProposalData, WizardStep } from "@/interfaces/proposalInterfaces";
import { PROPOSAL_WIZARD_STORAGE_KEY } from "@/constants";
import { logger } from "@/utils/logger";
import {
  useProposalWizardStore,
  DEFAULT_PROPOSAL_DATA,
  // Re-export granular selector hooks for convenience
  useProposalData,
  useProposalTitle,
  useClientName,
  useClientId,
  useCurrentStep,
  useMaxStepReached,
  useIsGenerating,
  useGeneratedProposalId,
  useCurrentProposalId,
  useEditMode,
  useHydrated,
  useShouldStartBackgroundFetch,
  useWizardActions,
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
  // Section recommendations prefetch actions
  prefetchRecommendations: (params: {
    templateId: string | null;
    existingSections: string[];
    context: string;
    documentContext: string;
  }) => Promise<any[]>;
  cancelRecommendationsFetch: () => void;
  invalidateRecommendationsCache: () => void;
  clearRecommendationsError: () => void;
}

// Module-level flag to ensure hydration only happens once
let hasHydratedGlobally = false;

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
  // Hydrate from localStorage on mount — read store actions via getState() to
  // avoid subscribing to state and causing an extra re-render cycle.
  useEffect(() => {
    if (hasHydratedGlobally) return;
    hasHydratedGlobally = true;

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
          // Only update if there's meaningful data to avoid unnecessary updates
          const hasMeaningfulData = saved.proposalData.title || saved.proposalData.clientName || saved.proposalData.description;
          if (hasMeaningfulData) {
            updateProposalData({
              ...DEFAULT_PROPOSAL_DATA,
              ...saved.proposalData,
              files: [],
              filesMeta: saved.proposalData.filesMeta ?? [],
              selectedDocumentIds: saved.proposalData.selectedDocumentIds ?? [],
              // Explicitly preserve section fields to ensure they're not overridden
              selectedSections: saved.proposalData.selectedSections ?? DEFAULT_PROPOSAL_DATA.selectedSections,
              sectionDisplayNames: saved.proposalData.sectionDisplayNames ?? DEFAULT_PROPOSAL_DATA.sectionDisplayNames,
              customSections: saved.proposalData.customSections ?? [],
              webReferences: saved.proposalData.webReferences ?? [],
              contextualInstructions: saved.proposalData.contextualInstructions ?? "",
            });
          }
        }
        if (saved.currentStep) {
          setCurrentStep(saved.currentStep);
        }
      }
    } catch (err) {
      logger.warn("[ProposalWizardProvider] Failed to restore draft from localStorage:", err);
    }
    // Set hydrated flag after all updates are complete
    try {
      setHydrated(true);
    } catch (hydrationErr) {
      logger.error("[ProposalWizardProvider] Error setting hydrated flag:", hydrationErr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-persist to localStorage on user actions (no interval to prevent loops)
  // Set up event listeners once on mount
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      try {
        const state = useProposalWizardStore.getState();
        const proposalData = state.proposalData;
        const currentStep = state.currentStep;

        // Only save if there's meaningful data
        if (!proposalData.title && !proposalData.clientName && !proposalData.description) {
          return;
        }

        const toSave = {
          proposalData: {
            ...proposalData,
            files: [],
            selectedSections: proposalData.selectedSections,
            sectionDisplayNames: proposalData.sectionDisplayNames,
          },
          currentStep,
        };
        localStorage.setItem(PROPOSAL_WIZARD_STORAGE_KEY, JSON.stringify(toSave));
      } catch (err) {
        logger.warn("[ProposalWizardProvider] Failed to persist draft to localStorage:", err);
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        handleBeforeUnload();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <>{children}</>;
}

/**
 * useProposalWizard — returns wizard state and actions from the Zustand store.
 *
 * @deprecated This hook subscribes to the entire store, causing unnecessary re-renders.
 * Use granular selector hooks instead (e.g., useProposalData, useCurrentStep, useIsGenerating).
 * Components subscribing to this hook re-render on any wizard state change.
 *
 * For optimal performance, prefer:
 * - useProposalData() for proposal data
 * - useCurrentStep() for current step
 * - useIsGenerating() for generation status
 * - useWizardActions() for actions (state-free)
 */
export function useProposalWizard(): ProposalWizardContextType {
  return useProposalWizardStore();
}
