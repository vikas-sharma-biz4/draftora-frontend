import type {
  DraftLocation,
  DraftStage,
  DraftUIState,
  SaveDraftPayload,
} from "@/interfaces/draftInterfaces";
import type { ProposalWizardData, WizardStep } from "@/interfaces/proposalInterfaces";
import type { SectionRecommendation } from "@/services/proposal";

/**
 * Builds a `ProposalWizardData` object from the fields that vary per save,
 * resetting `contextualInstructions` to empty on each save. `customSections`
 * is passed through so that user-defined custom sections survive draft saves
 * and recovery.
 *
 * Previously duplicated identically in useSaveDraft, useWizardAutoSave,
 * and useDraftPersistence.
 */
export type DraftProposalDataInput = Omit<ProposalWizardData, "contextualInstructions">;

export function buildDraftProposalData(input: DraftProposalDataInput): ProposalWizardData {
  return {
    ...input,
    contextualInstructions: "",
  };
}

/**
 * Input options for `buildDraftPayload`.
 * Callers supply the full wizard state; the factory applies fallbacks and
 * assembles the `SaveDraftPayload` shape required by the draft API.
 */
export interface BuildDraftPayloadOptions {
  proposalId: number | null | undefined;
  title: string;
  clientName: string;
  status?: SaveDraftPayload["status"];
  lastLocation: DraftLocation;
  stage: DraftStage;
  proposalData: ProposalWizardData;
  currentStep: WizardStep;
  maxStepReached: WizardStep;
  completedSteps: number[];
  generatedContent: Record<string, string>;
  uiState: DraftUIState;
  hasEdits?: boolean;
  prefetchedRecommendations?: SectionRecommendation[] | null;
}

/**
 * Assembles a `SaveDraftPayload` from raw wizard state fields.
 * Title/clientName fallbacks ("Untitled Proposal", "") are applied inside
 * the factory so callers can pass the raw values without repeating the pattern.
 *
 * Previously duplicated identically in useSaveDraft, useWizardAutoSave,
 * and useDraftPersistence.
 */
export function buildDraftPayload(options: BuildDraftPayloadOptions): SaveDraftPayload {
  const payload: SaveDraftPayload = {
    proposalId: options.proposalId ?? null,
    title: options.title || "Untitled Proposal",
    clientName: options.clientName || "",
    status: options.status ?? "draft",
    lastLocation: options.lastLocation,
    stage: options.stage,
    wizardState: {
      proposalData: options.proposalData,
      currentStep: options.currentStep,
      maxStepReached: options.maxStepReached,
      completedSteps: options.completedSteps,
      prefetchedRecommendations: options.prefetchedRecommendations ?? null,
    },
    generatedContent: options.generatedContent,
    uiState: options.uiState,
  };
  if (options.hasEdits !== undefined) {
    payload.hasEdits = options.hasEdits;
  }
  return payload;
}
