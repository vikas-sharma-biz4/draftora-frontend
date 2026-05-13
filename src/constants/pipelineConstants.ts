/**
 * Pipeline-related constants
 *
 * Defines workflow stages and step configurations for the proposal generation pipeline.
 */

import type { DraftStage } from "@/interfaces/draftInterfaces";

export interface PipelineStep {
  id: number;
  label: string;
  path: string;
  stage: DraftStage;
}

/**
 * Pipeline steps configuration
 *
 * Defines the sequential steps in the proposal generation workflow,
 * mapping each step to its route path and corresponding draft stage.
 */
export const PIPELINE_STEPS: PipelineStep[] = [
  { id: 1, label: "Parameters", path: "/parameters", stage: "wizard_in_progress" },
  { id: 2, label: "Review", path: "/review", stage: "parameters_complete" },
  { id: 3, label: "Web View", path: "/web-view", stage: "review_complete" },
];

/**
 * Pipeline stages
 *
 * High-level stages in the sales pipeline workflow.
 */
export const PIPELINE_STAGES = [
  "Discovery",
  "Qualification",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
] as const;
