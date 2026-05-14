import { http } from "@/config/httpClient";
import type { SavedDraft, SaveDraftPayload, DraftMetadata, DraftStage, DraftLocation } from "@/interfaces/draftInterfaces";
import type { RawProposalData } from "@/interfaces/proposalInterfaces";
import { mapRawProposalData } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";

// ─── Runtime Validation ─────────────────────────────────────────────────────

const VALID_STAGES: DraftStage[] = [
  "template_selection", "wizard_in_progress", "parameters_complete", "review_complete", "generated",
];

const VALID_LOCATIONS: DraftLocation[] = [
  "wizard_parameters", "wizard_review", "web_view", "ai_sections",
];

const VALID_STATUSES = [
  "draft", "generating", "completed", "pending_approval",
] as const;

type DraftStatus = typeof VALID_STATUSES[number];

function parseDraftStage(raw: string): DraftStage {
  if ((VALID_STAGES as readonly string[]).includes(raw)) return raw as DraftStage;
  logger.warn(`[draft.service] Unknown DraftStage "${raw}" — defaulting to "template_selection"`);
  return "template_selection";
}

function parseDraftLocation(raw: string): DraftLocation {
  if ((VALID_LOCATIONS as readonly string[]).includes(raw)) return raw as DraftLocation;
  logger.warn(`[draft.service] Unknown DraftLocation "${raw}" — defaulting to "wizard_parameters"`);
  return "wizard_parameters";
}

function parseDraftStatus(raw: string): DraftStatus {
  if ((VALID_STATUSES as readonly string[]).includes(raw)) return raw as DraftStatus;
  logger.warn(`[draft.service] Unknown DraftStatus "${raw}" — defaulting to "draft"`);
  return "draft";
}

// ─── Shared Types & Mappers ──────────────────────────────────────────────────

/**
 * Raw API response types for saved draft (snake_case from backend)
 */
interface RawWizardState {
  current_step: number;
  max_step_reached: number;
  completed_steps: number[];
  proposal_data: RawProposalData;
}

interface RawUIState {
  scroll_position: number;
  active_section: string | null;
  expanded_sections: string[];
  last_visible_section: string | null;
}

/**
 * Raw API response type for draft list items (snake_case from backend)
 */
interface RawDraftListItem {
  id: string;
  proposal_id: number | null;
  title: string;
  client_name: string;
  status: string;
  last_location: string;
  stage: string;
  updated_at: string;
}

interface RawSavedDraft {
  id: string;
  proposal_id: number | null;
  title: string;
  client_name: string;
  status: string;
  last_location: string;
  stage: string;
  wizard_state: RawWizardState;
  generated_content: Record<string, string>;
  ui_state: RawUIState;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Maps raw wizard state from API to typed DraftWizardState
 */
function mapWizardState(raw: RawWizardState): SavedDraft["wizardState"] {
  return {
    currentStep: raw.current_step as SavedDraft["wizardState"]["currentStep"],
    maxStepReached: raw.max_step_reached as SavedDraft["wizardState"]["maxStepReached"],
    completedSteps: raw.completed_steps,
    proposalData: mapRawProposalData(raw.proposal_data),
  };
}

/**
 * Maps raw UI state from API to typed DraftUIState
 */
function mapUIState(raw: RawUIState): SavedDraft["uiState"] {
  return {
    scrollPosition: raw.scroll_position,
    activeSection: raw.active_section,
    expandedSections: raw.expanded_sections,
    lastVisibleSection: raw.last_visible_section,
  };
}

/**
 * Maps raw API response to SavedDraft (snake_case → camelCase)
 */
function mapSavedDraft(data: RawSavedDraft): SavedDraft {
  return {
    id: data.id,
    proposalId: data.proposal_id,
    title: data.title,
    clientName: data.client_name,
    status: parseDraftStatus(data.status),
    lastLocation: parseDraftLocation(data.last_location),
    stage: parseDraftStage(data.stage),
    wizardState: mapWizardState(data.wizard_state),
    generatedContent: data.generated_content,
    uiState: mapUIState(data.ui_state),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    version: data.version,
  };
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function saveDraft(payload: SaveDraftPayload): Promise<SavedDraft> {
  logger.info('[draft.service] Creating draft:', { title: payload.title, clientName: payload.clientName });

  const data = await http.post<RawSavedDraft>("/drafts", {
    proposal_id: payload.proposalId,
    title: payload.title,
    client_name: payload.clientName,
    status: payload.status,
    last_location: payload.lastLocation,
    stage: payload.stage,
    wizard_state: payload.wizardState,
    generated_content: payload.generatedContent,
    ui_state: payload.uiState,
  });

  const saved = mapSavedDraft(data);
  logger.info('[draft.service] Draft created, backend ID:', saved.id);
  return saved;
}

export async function updateDraft(
  draftId: string,
  payload: Partial<SaveDraftPayload>
): Promise<SavedDraft> {
  if (!draftId) {
    logger.error('[draft.service] updateDraft called without draftId');
    throw new Error('Cannot update draft: missing draftId');
  }

  logger.info('[draft.service] Updating draft:', { draftId, title: payload.title });

  const data = await http.put<RawSavedDraft>(`/drafts/${draftId}/`, {
    proposal_id: payload.proposalId,
    title: payload.title,
    client_name: payload.clientName,
    status: payload.status,
    last_location: payload.lastLocation,
    stage: payload.stage,
    wizard_state: payload.wizardState,
    generated_content: payload.generatedContent,
    ui_state: payload.uiState,
  });

  const updated = mapSavedDraft(data);
  logger.info('[draft.service] Draft updated:', { draftId: updated.id });
  return updated;
}

export async function getDraft(draftId: string): Promise<SavedDraft> {
  const data = await http.get<RawSavedDraft>(`/drafts/${draftId}/`, { cache: "no-store" });
  return mapSavedDraft(data);
}

export interface ListDraftsParams {
  limit?: number;
  offset?: number;
}

export async function listDrafts(params?: ListDraftsParams): Promise<DraftMetadata[]> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set("limit", String(params.limit));
  if (params?.offset) queryParams.set("offset", String(params.offset));
  const qs = queryParams.toString();
  const url = `/drafts/${qs ? `?${qs}` : ""}`;

  const data = await http.get<RawDraftListItem[]>(url, { cache: "no-store" });

  return data.map((d) => ({
    id: d.id,
    proposalId: d.proposal_id,
    title: d.title,
    clientName: d.client_name,
    status: parseDraftStatus(d.status),
    lastLocation: parseDraftLocation(d.last_location),
    stage: parseDraftStage(d.stage),
    updatedAt: d.updated_at,
  }));
}

/**
 * Fetch a single draft by its associated proposalId.
 * Avoids the N+1 pattern of calling listDrafts() and then .find().
 */
export async function getDraftByProposalId(proposalId: number): Promise<DraftMetadata | null> {
  const data = await http.get<RawDraftListItem[]>(
    `/drafts/?proposal_id=${proposalId}`,
    { cache: "no-store" },
  );

  const first = data[0];
  if (!first) return null;

  return {
    id: first.id,
    proposalId: first.proposal_id,
    title: first.title,
    clientName: first.client_name,
    status: parseDraftStatus(first.status),
    lastLocation: parseDraftLocation(first.last_location),
    stage: parseDraftStage(first.stage),
    updatedAt: first.updated_at,
  };
}

export async function deleteDraft(draftId: string): Promise<void> {
  await http.delete<null>(`/drafts/${draftId}`);
}

export async function deleteAllDrafts(): Promise<void> {
  await http.delete<null>("/drafts");
}
