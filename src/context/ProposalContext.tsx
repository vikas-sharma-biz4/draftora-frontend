"use client";

import React from "react";
import type { DraftStage } from "@/interfaces/draftInterfaces";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { ProposalWizardProvider, useProposalWizard } from "./ProposalWizardContext";
import { useVisitedPipelineSteps, usePipelineActions } from "@/store/features/pipeline/pipelineSlice";
import type { ProposalData, WizardStep } from "@/interfaces/proposalInterfaces";

// ── Focused domain hooks ────────────────────────────────────────────────────
// Each hook subscribes only to its own state source, preventing cross-domain
// re-renders. Components should import the narrowest hook they need.

/** Re-export wizard hook for direct consumption */
export { useProposalWizard } from "./ProposalWizardContext";

/** Pipeline state hooks - use these directly instead of deprecated Context */
export { useVisitedPipelineSteps, usePipelineActions } from "@/store/features/pipeline/pipelineSlice";

/** Backward-compatible re-export for code still importing from ProposalContext */
export { useProposalPipeline } from "./ProposalPipelineContext";

/**
 * Draft session state — thin wrapper around the Zustand store
 * with selective subscriptions to minimise re-renders.
 */
export function useProposalDraftSession(): {
  draftStage: DraftStage;
  completedSteps: number[];
  setDraftStage: (stage: DraftStage) => void;
  setCompletedSteps: (steps: number[]) => void;
  markStepCompleted: (stepId: number) => void;
  setCurrentDraftId: (id: string | null) => void;
} {
  const draftStage = useDraftSessionStore((s) => s.draftStage);
  const completedSteps = useDraftSessionStore((s) => s.completedSteps);
  const setDraftStage = useDraftSessionStore((s) => s.setDraftStage);
  const setCompletedSteps = useDraftSessionStore((s) => s.setCompletedSteps);
  const markStepCompleted = useDraftSessionStore((s) => s.markStepCompleted);
  const setCurrentDraftId = useDraftSessionStore((s) => s.setCurrentDraftId);

  return {
    draftStage,
    completedSteps,
    setDraftStage,
    setCompletedSteps,
    markStepCompleted,
    setCurrentDraftId,
  };
}

// ── Backward-compatible aggregate hook ──────────────────────────────────────

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
  completedSteps: number[];
  setDraftStage: (stage: DraftStage) => void;
  setCompletedSteps: (steps: number[]) => void;
  markStepCompleted: (stepId: number) => void;
  setCurrentDraftId: (id: string | null) => void;
  visitedPipelineSteps: number[];
  syncVisitedStepsFromBackend: (proposalId: number) => Promise<void>;
  markStepVisitedOnBackend: (proposalId: number, stepId: number) => Promise<void>;
  shouldStartBackgroundFetch: boolean;
  setShouldStartBackgroundFetch: (val: boolean) => void;
}

/**
 * @deprecated Use the focused domain hooks instead to avoid unnecessary re-renders:
 *   - useProposalWizard()    — proposal data, steps, generation state, edit mode
 *   - useVisitedPipelineSteps() and usePipelineActions()  — pipeline state
 *   - useProposalDraftSession() — draft stage, completed steps, draft ID
 *
 * This aggregate hook is retained for backward compatibility during migration.
 * It composes the three focused hooks directly (no bridge context), so each
 * sub-hook still only triggers re-renders for its own state changes.
 */
export function useProposal(): ProposalContextType {
  const wizard = useProposalWizard();
  const visitedPipelineSteps = useVisitedPipelineSteps();
  const { syncVisitedStepsFromBackend, markStepVisitedOnBackend } = usePipelineActions();
  const draftSession = useProposalDraftSession();

  return {
    ...wizard,
    visitedPipelineSteps,
    syncVisitedStepsFromBackend,
    markStepVisitedOnBackend,
    ...draftSession,
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ProposalProvider({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <ProposalWizardProvider>
      {children}
    </ProposalWizardProvider>
  );
}
