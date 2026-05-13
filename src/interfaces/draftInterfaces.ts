import type { ProposalData, WizardStep } from "./proposalInterfaces";

export type DraftStage =
  | "template_selection"
  | "wizard_in_progress"
  | "parameters_complete"
  | "review_complete"
  | "generated";

export type DraftLocation =
  | "wizard_parameters"
  | "wizard_review"
  | "web_view"
  | "ai_sections";

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
  status: "draft" | "generating" | "completed" | "pending_approval";
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
  proposalId: number | null;
  title: string;
  clientName: string;
  status: "draft" | "generating" | "completed" | "pending_approval";
  lastLocation: DraftLocation;
  stage: DraftStage;
  updatedAt: string;
}

export interface SaveDraftPayload {
  proposalId: number | null;
  title: string;
  clientName: string;
  status: "draft" | "generating" | "completed" | "pending_approval";
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
