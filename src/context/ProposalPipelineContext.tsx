"use client";

import React, { createContext, useContext } from "react";
import { usePipelineSteps } from "@/hooks/usePipelineSteps";

interface ProposalPipelineContextType {
  visitedPipelineSteps: number[];
  syncVisitedStepsFromBackend: (proposalId: number) => Promise<void>;
  markStepVisitedOnBackend: (proposalId: number, stepId: number) => Promise<void>;
}

const ProposalPipelineContext = createContext<ProposalPipelineContextType | undefined>(
  undefined
);

export function ProposalPipelineProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const { visitedPipelineSteps, syncVisitedStepsFromBackend, markStepVisitedOnBackend } =
    usePipelineSteps();

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

export function useProposalPipeline(): ProposalPipelineContextType {
  const ctx = useContext(ProposalPipelineContext);
  if (!ctx) {
    throw new Error("useProposalPipeline must be used within a ProposalPipelineProvider");
  }
  return ctx;
}
