"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { ProposalStatus } from "@/interfaces/proposalInterfaces";

export type GenerationLifecycleStage =
  | "idle"
  | "initializing"
  | "analyzing"
  | "generating"
  | "polishing"
  | "completed"
  | "failed";

interface GenerationState {
  // ── Status ──
  proposalId: number | null;
  status: GenerationLifecycleStage;
  progressPercent: number;
  totalSections: number;
  completedSections: number;
  currentSection: string | null;
  currentStage: string | null;
  estimatedTimeRemaining: number | null;
  errorMessage: string | null;
  isPolling: boolean;

  // ── Actions ──
  startGeneration: (proposalId: number) => void;
  updateFromStatus: (status: ProposalStatus) => void;
  setPolling: (isPolling: boolean) => void;
  setError: (message: string) => void;
  completeGeneration: () => void;
  failGeneration: (message?: string) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  proposalId: null as number | null,
  status: "idle" as GenerationLifecycleStage,
  progressPercent: 0,
  totalSections: 0,
  completedSections: 0,
  currentSection: null as string | null,
  currentStage: null as string | null,
  estimatedTimeRemaining: null as number | null,
  errorMessage: null as string | null,
  isPolling: false,
};

function mapStatusToLifecycle(backendStatus: string): GenerationLifecycleStage {
  switch (backendStatus) {
    case "pending":
      return "initializing";
    case "in_progress":
      return "generating";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "failed";
    default:
      return "initializing";
  }
}

export const useGenerationStore = create<GenerationState>((set) => ({
  ...INITIAL_STATE,

  startGeneration: (proposalId: number) =>
    set({
      ...INITIAL_STATE,
      proposalId,
      status: "initializing",
      isPolling: true,
    }),

  updateFromStatus: (status: ProposalStatus) =>
    set({
      status: mapStatusToLifecycle(status.status),
      progressPercent: status.progressPercent ?? 0,
      totalSections: status.totalSections ?? 0,
      completedSections: status.completedSections.length,
      currentSection: status.currentSection,
      currentStage: status.currentStage,
      estimatedTimeRemaining: status.estimatedTimeRemaining ?? null,
    }),

  setPolling: (isPolling: boolean) => set({ isPolling }),

  setError: (message: string) =>
    set({
      errorMessage: message,
      status: "failed",
      isPolling: false,
    }),

  completeGeneration: () =>
    set({
      status: "completed",
      progressPercent: 100,
      isPolling: false,
      currentSection: null,
      currentStage: null,
      estimatedTimeRemaining: null,
    }),

  failGeneration: (message?: string) =>
    set({
      status: "failed",
      isPolling: false,
      errorMessage: message ?? "Proposal generation failed. Please go back and try again.",
    }),

  reset: () => set(INITIAL_STATE),
}));

// ── Granular selectors ──
export const useGenerationStatus = () =>
  useGenerationStore((state) => state.status);

export const useGenerationProgress = () =>
  useGenerationStore((state) => state.progressPercent);

export const useGenerationProposalId = () =>
  useGenerationStore((state) => state.proposalId);

export const useGenerationError = () =>
  useGenerationStore((state) => state.errorMessage);

export const useGenerationIsPolling = () =>
  useGenerationStore((state) => state.isPolling);

export const useGenerationCurrentSection = () =>
  useGenerationStore((state) => state.currentSection);

export const useGenerationCurrentStage = () =>
  useGenerationStore((state) => state.currentStage);

export const useGenerationTotalSections = () =>
  useGenerationStore((state) => state.totalSections);

export const useGenerationCompletedSections = () =>
  useGenerationStore((state) => state.completedSections);

export const useGenerationEstimatedTime = () =>
  useGenerationStore((state) => state.estimatedTimeRemaining);

export const useGenerationActions = () =>
  useGenerationStore(useShallow((state) => ({
    startGeneration: state.startGeneration,
    updateFromStatus: state.updateFromStatus,
    setPolling: state.setPolling,
    setError: state.setError,
    completeGeneration: state.completeGeneration,
    failGeneration: state.failGeneration,
    reset: state.reset,
  })));
