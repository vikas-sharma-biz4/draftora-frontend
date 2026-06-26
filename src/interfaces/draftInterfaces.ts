import type { ProposalWizardData, WizardStep, TemplateType } from "./proposalInterfaces";
import type { SectionRecommendation } from "@/services/proposal";

export type DraftStage =
  | "template_selection"
  | "wizard_in_progress"
  | "parameters_complete"
  | "review_complete"
  | "generated";

export type DraftLocation = "wizard_parameters" | "wizard_review" | "web_view" | "ai_sections";

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
  proposalData: ProposalWizardData;
  prefetchedRecommendations?: SectionRecommendation[] | null;
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
  hasEdits: boolean;
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
  hasEdits?: boolean;
  templateId?: string | null;
  templateType?: TemplateType;
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
  hasEdits?: boolean;
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
