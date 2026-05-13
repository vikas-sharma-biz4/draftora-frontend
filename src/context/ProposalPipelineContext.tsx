"use client";

import React, { createContext, useContext } from "react";
import {
  useVisitedPipelineSteps,
  usePipelineActions,
} from "@/store/features/pipeline/pipelineSlice";

interface ProposalPipelineContextType {
  visitedPipelineSteps: number[];
  syncVisitedStepsFromBackend: (proposalId: number) => Promise<void>;
  markStepVisitedOnBackend: (proposalId: number, stepId: number) => Promise<void>;
}

const ProposalPipelineContext = createContext<ProposalPipelineContextType | undefined>(
  undefined
);

/**
 * ProposalPipelineProvider — compatibility wrapper for incremental migration.
 *
 * @deprecated This provider now delegates to the Zustand pipeline store.
 * New code should use granular selector hooks directly:
 * - useVisitedPipelineSteps() for state
 * - usePipelineActions() for actions
 *
 * This provider is retained for backward compatibility during migration.
 */
export function ProposalPipelineProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const visitedPipelineSteps = useVisitedPipelineSteps();
  const { syncVisitedStepsFromBackend, markStepVisitedOnBackend } = usePipelineActions();

  return (
    <ProposalPipelineContext.Provider
      value={{
        visitedPipelineSteps,
        syncVisitedStepsFromBackend,
        markStepVisitedOnBackend,
      }}
    >
      {children}
    </ProposalPipelineContext.Provider>
  );
}

/**
 * useProposalPipeline — compatibility hook for incremental migration.
 *
 * @deprecated Use granular selector hooks instead:
 * - useVisitedPipelineSteps() for visited steps
 * - usePipelineActions() for actions
 */
export function useProposalPipeline(): ProposalPipelineContextType {
  const ctx = useContext(ProposalPipelineContext);
  if (!ctx) {
    throw new Error("useProposalPipeline must be used within a ProposalPipelineProvider");
  }
  return ctx;
}
