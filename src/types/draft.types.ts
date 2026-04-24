export type DraftStage = 
  | "template_selection"
  | "wizard_in_progress"
  | "parameters_complete"
  | "review_complete"
  | "generated";

export interface SavedDraft {
  id: string;
  title: string;
  clientName: string;
  stage: DraftStage;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
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
