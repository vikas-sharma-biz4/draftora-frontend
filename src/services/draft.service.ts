import { http } from "@/config/httpClient";
import type { SavedDraft, SaveDraftPayload, DraftMetadata, DraftStage, DraftLocation } from "@/interfaces/draftInterfaces";
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
 * Converts camelCase object keys to snake_case (recursive)
 */
function camelToSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => camelToSnakeCase(item));
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        result[snakeKey] = camelToSnakeCase((obj as Record<string, unknown>)[key]);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Raw API response types for saved draft (snake_case from backend)
 */
interface RawWizardState {
  currentStep: number;
  maxStepReached: number;
  completedSteps: number[];
  proposalData: Record<string, unknown>;
}

interface RawUIState {
  scrollPosition: number;
  activeSection: string | null;
  expandedSections: string[];
  lastVisibleSection: string | null;
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
  console.log('[draft.service] mapWizardState called with:', {
    rawProposalData: raw.proposalData,
    rawProposalDataKeys: raw.proposalData ? Object.keys(raw.proposalData) : [],
  });

  return {
    currentStep: raw.currentStep as SavedDraft["wizardState"]["currentStep"],
    maxStepReached: raw.maxStepReached as SavedDraft["wizardState"]["maxStepReached"],
    completedSteps: raw.completedSteps,
    proposalData: raw.proposalData as unknown as SavedDraft["wizardState"]["proposalData"],
  };
}

/**
 * Maps raw UI state from API to typed DraftUIState
 */
function mapUIState(raw: RawUIState): SavedDraft["uiState"] {
  return {
    scrollPosition: raw.scrollPosition,
    activeSection: raw.activeSection,
    expandedSections: raw.expandedSections,
    lastVisibleSection: raw.lastVisibleSection,
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
  logger.info('[draft.service] Saving draft to backend', {
    proposalId: payload.proposalId,
    title: payload.title,
    clientName: payload.clientName,
    stage: payload.stage,
    lastLocation: payload.lastLocation,
    // Log wizardState structure
    wizardStateKeys: Object.keys(payload.wizardState),
    proposalDataKeys: payload.wizardState.proposalData ? Object.keys(payload.wizardState.proposalData) : [],
    selectedSections: payload.wizardState.proposalData?.selectedSections,
    filesMeta: payload.wizardState.proposalData?.filesMeta,
    selectedDocumentIds: payload.wizardState.proposalData?.selectedDocumentIds,
    webReferences: payload.wizardState.proposalData?.webReferences,
    sectionDisplayNames: payload.wizardState.proposalData?.sectionDisplayNames,
  });

  console.log('[draft.service] Sending to backend (without snake_case conversion):', {
    title: payload.title,
    clientName: payload.clientName,
    wizardState: payload.wizardState,
    selectedSections: payload.wizardState.proposalData?.selectedSections,
    filesMeta: payload.wizardState.proposalData?.filesMeta,
    selectedDocumentIds: payload.wizardState.proposalData?.selectedDocumentIds,
    webReferences: payload.wizardState.proposalData?.webReferences,
    sectionDisplayNames: payload.wizardState.proposalData?.sectionDisplayNames,
  });

  // TEMPORARILY DISABLE snake_case conversion to test
  const data = await http.post<RawSavedDraft>("/drafts/", {
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

  console.log('[draft.service] Received from backend:', {
    id: data.id,
    wizardState: data.wizard_state,
    proposalData: data.wizard_state.proposalData,
    selectedSections: data.wizard_state.proposalData?.selectedSections,
    filesMeta: data.wizard_state.proposalData?.filesMeta,
    selectedDocumentIds: data.wizard_state.proposalData?.selectedDocumentIds,
    webReferences: data.wizard_state.proposalData?.webReferences,
    sectionDisplayNames: data.wizard_state.proposalData?.sectionDisplayNames,
  });

  logger.info('[draft.service] Draft saved successfully', {
    draftId: data.id,
    responseWizardStateKeys: Object.keys(data.wizard_state),
    responseProposalDataKeys: data.wizard_state.proposalData ? Object.keys(data.wizard_state.proposalData) : [],
    responseSelectedSections: data.wizard_state.proposalData?.selectedSections,
    responseFilesMeta: data.wizard_state.proposalData?.filesMeta,
    responseSelectedDocumentIds: data.wizard_state.proposalData?.selectedDocumentIds,
    responseWebReferences: data.wizard_state.proposalData?.webReferences,
    responseSectionDisplayNames: data.wizard_state.proposalData?.sectionDisplayNames,
  });

  return mapSavedDraft(data);
}

export async function updateDraft(
  draftId: string,
  payload: Partial<SaveDraftPayload>
): Promise<SavedDraft> {
  // TEMPORARILY DISABLE snake_case conversion to test
  const data = await http.put<RawSavedDraft>(`/drafts/${draftId}`, {
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
  return mapSavedDraft(data);
}

export async function getDraft(draftId: string): Promise<SavedDraft> {
  console.log('[draft.service] Fetching draft from backend:', { draftId });

  const data = await http.get<RawSavedDraft>(`/drafts/${draftId}`, { cache: "no-store" });

  console.log('[draft.service] Received draft from backend:', {
    id: data.id,
    title: data.title,
    clientName: data.client_name,
    wizardState: data.wizard_state,
    proposalData: data.wizard_state.proposalData,
    selectedSections: data.wizard_state.proposalData?.selectedSections,
    filesMeta: data.wizard_state.proposalData?.filesMeta,
    selectedDocumentIds: data.wizard_state.proposalData?.selectedDocumentIds,
    webReferences: data.wizard_state.proposalData?.webReferences,
    sectionDisplayNames: data.wizard_state.proposalData?.sectionDisplayNames,
  });

  logger.info('[draft.service] Draft fetched successfully', {
    draftId: data.id,
    responseWizardStateKeys: Object.keys(data.wizard_state),
    responseProposalDataKeys: data.wizard_state.proposalData ? Object.keys(data.wizard_state.proposalData) : [],
    responseSelectedSections: data.wizard_state.proposalData?.selectedSections,
    responseFilesMeta: data.wizard_state.proposalData?.filesMeta,
    responseSelectedDocumentIds: data.wizard_state.proposalData?.selectedDocumentIds,
    responseWebReferences: data.wizard_state.proposalData?.webReferences,
    responseSectionDisplayNames: data.wizard_state.proposalData?.sectionDisplayNames,
  });

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

  const response = await http.get<{ drafts: RawDraftListItem[] } | unknown>(url, { cache: "no-store" });

  // Extract drafts array from response envelope
  const data = typeof response === 'object' && response !== null && 'drafts' in response
    ? (response as { drafts: RawDraftListItem[] }).drafts
    : [];

  // Defensive check: ensure data is an array before mapping
  if (!Array.isArray(data)) {
    logger.error("[draft.service] listDrafts received non-array response:", { data });
    return [];
  }

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
 * Returns null if no draft exists (404 is not an error — it means "no draft yet").
 */
export async function getDraftByProposalId(proposalId: number): Promise<DraftMetadata | null> {
  try {
    const response = await http.get<{ drafts: RawDraftListItem[] } | unknown>(
      `/drafts?proposal_id=${proposalId}`,
      { cache: "no-store" },
    );

    // Extract drafts array from response envelope
    const data = typeof response === 'object' && response !== null && 'drafts' in response
      ? (response as { drafts: RawDraftListItem[] }).drafts
      : [];

    // Defensive check: ensure data is an array before accessing
    if (!Array.isArray(data)) {
      logger.error("[draft.service] getDraftByProposalId received non-array response:", { data });
      return null;
    }

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
  } catch (error: unknown) {
    // 404 means "no draft exists yet" — not a fatal error
    if (error instanceof Error && "statusCode" in error && (error as any).statusCode === 404) {
      logger.info("[draft.service] No draft found for proposal_id=%d (404)", proposalId);
      return null;
    }
    // Other errors (network, 500, etc.) — log but don't crash
    logger.warn("[draft.service] Failed to fetch draft for proposal_id=%d", proposalId, error);
    return null;
  }
}

export async function deleteDraft(draftId: string): Promise<void> {
  await http.delete<null>(`/drafts/${draftId}`);
}

export async function deleteAllDrafts(): Promise<void> {
  await http.delete<null>("/drafts/");
}
