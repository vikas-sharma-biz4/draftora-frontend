import type { ProposalData, WizardStep } from "./proposal.types";

export type DraftStage = 
  | "template_selection"
  | "wizard_in_progress"
  | "parameters_complete"
  | "review_complete"
  | "generated";

export type DraftLocation = 
  | "WIZARD_PARAMETERS"
  | "WIZARD_REVIEW"
  | "WEB_VIEW"
  | "AI_SECTIONS";

export interface DraftUIState {
  scrollPosition: number;
  activeSection: string | null;
  expandedSections: string[];
  lastVisibleSection: string | null;
}

export interface DraftWizardState {
  currentStep: WizardStep;
  maxStepReached: WizardStep;
  completedSteps: number[];
  proposalData: ProposalData;
}

export interface SavedDraft {
  id: string;
  proposalId: number | null;
  title: string;
  clientName: string;
  status: "draft" | "generating" | "completed";
  lastLocation: DraftLocation;
  stage: DraftStage;
  wizardState: DraftWizardState;
  generatedContent: Record<string, string>;
  uiState: DraftUIState;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DraftMetadata {
  id: string;
  title: string;
  clientName: string;
  status: "draft" | "generating" | "completed";
  lastLocation: DraftLocation;
  stage: DraftStage;
  updatedAt: string;
}

export interface SaveDraftPayload {
  proposalId: number | null;
  title: string;
  clientName: string;
  status: "draft" | "generating" | "completed";
  lastLocation: DraftLocation;
  stage: DraftStage;
  wizardState: DraftWizardState;
  generatedContent: Record<string, string>;
  uiState: DraftUIState;
}

export interface PipelineStep {
  id: number;
  label: string;
  path: string;
  stage: DraftStage;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { id: 1, label: "Parameters", path: "/parameters", stage: "wizard_in_progress" },
  { id: 2, label: "Review", path: "/review", stage: "parameters_complete" },
  { id: 3, label: "Web View", path: "/web-view", stage: "review_complete" },
];
