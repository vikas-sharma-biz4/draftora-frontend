/**
 * Proposal CRUD operations
 *
 * Create, read, list, download, cancel, and approval status management.
 */

import { DEFAULT_AI_MODEL } from "@/config/config";
import { http, buildUrl, HttpError } from "@/config/httpClient";
import type {
  ProposalData,
  ProposalWizardData,
  ProposalListItem,
  ToneOption,
  LengthOption,
  TemplateType,
  EstimatedHoursData,
} from "@/interfaces/proposalInterfaces";
import { assertApiShape } from "@/utils/assertApiShape";
import { logger } from "@/utils/logger";

function parseToneOption(raw: string): ToneOption {
  const valid: ToneOption[] = ["professional", "persuasive", "technical", "creative"];
  if ((valid as string[]).includes(raw)) return raw as ToneOption;
  logger.warn(`[proposalCrud] Unknown ToneOption "${raw}" — defaulting to "professional"`);
  return "professional";
}

function parseLengthOption(raw: string): LengthOption {
  const valid: LengthOption[] = ["concise", "balanced", "comprehensive"];
  if ((valid as string[]).includes(raw)) return raw as LengthOption;
  logger.warn(`[proposalCrud] Unknown LengthOption "${raw}" — defaulting to "balanced"`);
  return "balanced";
}

function parseTemplateType(raw: string | null): TemplateType {
  const valid: TemplateType[] = [
    "predefined",
    "custom",
    "scratch",
    "mvp",
    "poc",
    "design",
    "brd",
    "frd",
    "srs",
    "architecture",
    "sow",
  ];
  if (raw && (valid as string[]).includes(raw)) return raw as TemplateType;
  logger.warn(`[proposalCrud] Unknown TemplateType "${raw}" — defaulting to "scratch"`);
  return "scratch";
}

interface CreateProposalResponse {
  id: number;
  status: string;
  jobId?: string | null;
}

export async function generateProposal(data: ProposalWizardData): Promise<CreateProposalResponse> {
  logger.info(
    "[generateProposal] Starting proposal generation request at",
    new Date().toISOString()
  );
  const startTime = Date.now();

  const formData = new FormData();

  // Only use custom sections that are actually selected
  const selectedCustomSections = data.customSections.filter((s) =>
    data.selectedSections.includes(s.key)
  );

  // Build contextual instructions — append custom section descriptions so the AI
  // knows what content to produce for user-defined sections.
  let contextual = data.contextualInstructions ?? "";
  if (selectedCustomSections.length > 0) {
    const customBlock = selectedCustomSections
      .map((s) => `- "${s.label}": ${s.description}`)
      .join("\n");
    const separator = contextual.trim() ? "\n\n" : "";
    contextual += `${separator}[Additional custom sections to include in the proposal]:\n${customBlock}`;
  }

  // selectedSections already contains selected custom section keys — no need to append again
  const allSections = [...data.selectedSections];

  // Merge section display names: selected custom sections + any from template parsing
  const sectionDisplayNames: Record<string, string> = {
    ...data.sectionDisplayNames,
    ...Object.fromEntries(selectedCustomSections.map((s) => [s.key, s.label])),
  };

  const proposalPayload: Record<string, unknown> = {
    title: data.title,
    client_id: data.clientId || 0,
    client_name: data.clientName,
    description: data.description,
    tone: data.tone,
    length_preference: data.lengthPreference,
    language: data.language,
    template_type: data.templateType || "scratch",
    ai_model: data.aiModel || DEFAULT_AI_MODEL,
    selected_sections: allSections,
    section_display_names: Object.keys(sectionDisplayNames).length > 0 ? sectionDisplayNames : null,
    contextual_instructions: contextual || null,
    web_references: data.webReferences,
    selected_document_ids: data.selectedDocumentIds || [],
  };

  formData.append("proposal_data", JSON.stringify(proposalPayload));

  logger.info("[generateProposal] Sending POST request to /proposals at", new Date().toISOString());
  const requestStartTime = Date.now();
  const response = await http.post<CreateProposalResponse>("/proposals", formData);
  const requestDuration = Date.now() - requestStartTime;
  const totalDuration = Date.now() - startTime;

  logger.info("[generateProposal] API call completed at", new Date().toISOString(), {
    requestDurationMs: requestDuration,
    totalDurationMs: totalDuration,
    proposalId: response.id,
    status: response.status,
    jobId: response.jobId,
  });

  if (requestDuration > 1000) {
    logger.warn(
      "[generateProposal] API call took longer than 1 second:",
      requestDuration,
      "ms - Backend may be doing synchronous generation"
    );
  }

  return response;
}

export interface ProposalStatus {
  id: number;
  status: string;
  generatingSection: string | null;
  completedSections: string[];
  selectedSections: string[] | null;
  currentStage: string | null;
  visitedPipelineSteps: number[];
  highestVisitedStep: number | null;
  totalSections: number;
  progressPercent: number;
}

interface ProposalStatusApiResponse {
  id: number;
  status: string;
  generating_section?: string | null;
  completed_sections?: string[];
  selected_sections?: string[] | null;
  current_stage?: string | null;
  visited_pipeline_steps?: number[];
  highest_visited_step?: number | null;
  total_sections?: number | null;
  progress_percent?: number;
  progress?: number;
}

export async function getProposalStatus(id: number): Promise<ProposalStatus> {
  const d = await http.get<ProposalStatusApiResponse>(`/proposals/${id}/status`, {
    cache: "no-store",
  });
  const completed = d.completed_sections ?? [];
  const totalSections = d.total_sections ?? d.selected_sections?.length ?? 0;

  // Calculate progress percentage based on completed sections
  // Use backend's progress_percentage if available, otherwise calculate from completed_sections
  let progressPercent = d.progress_percent ?? d.progress ?? 0;
  if (progressPercent === 0 && totalSections > 0 && completed.length > 0) {
    progressPercent = Math.round((completed.length / totalSections) * 100);
  } else if (
    progressPercent === 0 &&
    totalSections > 0 &&
    completed.length === 0 &&
    d.status === "generating"
  ) {
    // If generating but no sections completed yet, show a small initial progress
    progressPercent = 1;
  }

  const status: ProposalStatus = {
    id: d.id,
    status: d.status,
    generatingSection: d.generating_section ?? null,
    completedSections: d.completed_sections ?? [],
    selectedSections: d.selected_sections ?? null,
    currentStage: d.current_stage ?? null,
    visitedPipelineSteps: d.visited_pipeline_steps ?? [],
    highestVisitedStep: d.highest_visited_step ?? null,
    totalSections,
    progressPercent,
  };

  return status;
}

interface RawEstimatedHoursData {
  total_estimated_hours: { hours: number; description: string };
  team_breakdown: Array<{ role: string; hours: number; description: string }>;
  feature_list_used: string;
  custom_prompt_used?: string | null;
}

/** Raw backend response shape for GET /proposals/:id/ (snake_case) */
interface RawProposalApiResponse {
  id: number;
  title: string;
  client_name: string;
  client_id?: number;
  description: string | null;
  tone: string;
  length_preference: string;
  language: string;
  ai_model: string | null;
  selected_sections: string[] | null;
  section_display_names: Record<string, string> | null;
  contextual_instructions: string | null;
  web_references: string[] | null;
  selected_document_ids: number[] | null;
  template_type: string | null;
  status: string;
  approval_status: "pending" | "approved" | "rejected" | null;
  sections: Record<string, string> | null;
  section_types: Record<string, string> | null;
  generating_section: string | null;
  estimated_hours_data?: RawEstimatedHoursData | null;
  created_at: string;
  updated_at: string;
  // Versioning hierarchy fields
  version_label?: string | null;
  parent_proposal_id?: number | null;
  root_proposal_id?: number | null;
}

/** Map raw snake_case backend response to camelCase ProposalData */
function mapProposal(d: RawProposalApiResponse): ProposalData {
  return {
    id: d.id,
    title: d.title,
    clientName: d.client_name,
    clientId: d.client_id,
    description: d.description ?? "",
    tone: parseToneOption(d.tone),
    lengthPreference: parseLengthOption(d.length_preference),
    language: d.language,
    aiModel: d.ai_model ?? DEFAULT_AI_MODEL,
    selectedSections: d.selected_sections ?? [],
    sectionDisplayNames: d.section_display_names ?? {},
    customSections: [],
    contextualInstructions: d.contextual_instructions ?? "",
    webReferences: d.web_references ?? [],
    selectedDocumentIds: d.selected_document_ids ?? [],
    filesMeta: [],
    templateId: null,
    templateType: parseTemplateType(d.template_type),
    status: d.status,
    approvalStatus: d.approval_status ?? "pending",
    sections: d.sections ?? {},
    sectionTypes: d.section_types ?? {},
    generatingSection: d.generating_section ?? null,
    estimatedHoursData: d.estimated_hours_data
      ? {
          totalEstimatedHours: d.estimated_hours_data.total_estimated_hours,
          teamBreakdown: d.estimated_hours_data.team_breakdown,
          featureListUsed: d.estimated_hours_data.feature_list_used,
          customPromptUsed: d.estimated_hours_data.custom_prompt_used ?? undefined,
        }
      : undefined,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    versionLabel: d.version_label ?? null,
    parentProposalId: d.parent_proposal_id ?? null,
    rootProposalId: d.root_proposal_id ?? null,
  };
}

interface EstimateHoursPayload {
  custom_feature_list?: string;
  custom_prompt?: string;
}

interface RawEstimateHoursResponse {
  proposal_id: number;
  estimated_hours_data: RawEstimatedHoursData;
}

export async function regenerateProposal(
  proposalId: number,
  data: ProposalWizardData
): Promise<CreateProposalResponse> {
  const formData = new FormData();

  const selectedCustomSections = data.customSections.filter((s) =>
    data.selectedSections.includes(s.key)
  );

  let contextual = data.contextualInstructions ?? "";
  if (selectedCustomSections.length > 0) {
    const customBlock = selectedCustomSections
      .map((s) => `- "${s.label}": ${s.description}`)
      .join("\n");
    const separator = contextual.trim() ? "\n\n" : "";
    contextual += `${separator}[Additional custom sections to include in the proposal]:\n${customBlock}`;
  }

  const allSections = [...data.selectedSections];
  const sectionDisplayNames: Record<string, string> = {
    ...data.sectionDisplayNames,
    ...Object.fromEntries(selectedCustomSections.map((s) => [s.key, s.label])),
  };

  const proposalPayload: Record<string, unknown> = {
    title: data.title,
    client_id: data.clientId || 0,
    client_name: data.clientName,
    description: data.description,
    tone: data.tone,
    length_preference: data.lengthPreference,
    language: data.language,
    template_type: data.templateType || "scratch",
    ai_model: data.aiModel || DEFAULT_AI_MODEL,
    selected_sections: allSections,
    section_display_names: Object.keys(sectionDisplayNames).length > 0 ? sectionDisplayNames : null,
    contextual_instructions: contextual || null,
    web_references: data.webReferences,
    selected_document_ids: data.selectedDocumentIds || [],
  };

  formData.append("proposal_data", JSON.stringify(proposalPayload));

  const response = await http.post<CreateProposalResponse>(
    `/proposals/${proposalId}/regenerate`,
    formData
  );

  logger.info("[regenerateProposal] Regeneration started", {
    proposalId,
    responseId: response.id,
    status: response.status,
  });

  return response;
}

export async function estimateProposalHours(
  proposalId: number,
  body: EstimateHoursPayload = {}
): Promise<EstimatedHoursData> {
  const raw = await http.post<RawEstimateHoursResponse>(
    `/proposals/${proposalId}/estimate-hours`,
    body
  );
  const d = raw.estimated_hours_data;
  return {
    totalEstimatedHours: d.total_estimated_hours,
    teamBreakdown: d.team_breakdown,
    featureListUsed: d.feature_list_used,
    customPromptUsed: d.custom_prompt_used ?? undefined,
  };
}

const PROPOSAL_REQUIRED_FIELDS: (keyof RawProposalApiResponse)[] = [
  "id",
  "title",
  "client_name",
  "status",
  "tone",
  "length_preference",
  "language",
];

export async function getProposal(id: number): Promise<ProposalData> {
  const d = await http.get<RawProposalApiResponse>(`/proposals/${id}`, {
    cache: "no-store",
  });
  assertApiShape<RawProposalApiResponse>(d, PROPOSAL_REQUIRED_FIELDS, "[getProposal]");
  return mapProposal(d);
}

interface ProposalListApiItem {
  id: number;
  title: string;
  client_id: number;
  client_name: string;
  status: string;
  approval_status: "pending" | "approved" | "rejected";
  tone: string;
  length_preference: string;
  template_type: "predefined" | "custom" | "scratch" | "recreate";
  created_at: string;
  updated_at: string;
  version?: number | null;
  // Versioning hierarchy fields
  version_label?: string | null;
  parent_proposal_id?: number | null;
  root_proposal_id?: number | null;
}

export interface ListProposalsParams {
  limit?: number;
  offset?: number;
  page?: number;
  clientId?: number;
}

function mapProposalListItem(item: ProposalListApiItem): ProposalListItem {
  return {
    id: item.id,
    title: item.title,
    clientId: item.client_id,
    clientName: item.client_name,
    status: item.status,
    approvalStatus: item.approval_status || "pending",
    tone: parseToneOption(item.tone),
    lengthPreference: parseLengthOption(item.length_preference),
    templateType: parseTemplateType(item.template_type),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    version: item.version ?? null,
    versionLabel: item.version_label ?? null,
    parentProposalId: item.parent_proposal_id ?? null,
    rootProposalId: item.root_proposal_id ?? null,
  };
}

export async function listProposals(params?: ListProposalsParams): Promise<ProposalListItem[]> {
  // Legacy: offset-based pagination path (kept for backward compatibility)
  if (params?.offset !== undefined) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set("per_page", String(params.limit));
    queryParams.set("page", String(Math.floor((params.offset ?? 0) / (params.limit ?? 10)) + 1));
    const raw = await http.get<ProposalListApiItem[]>(`/proposals?${queryParams.toString()}`, {
      cache: "no-store",
    });
    return raw.map(mapProposalListItem);
  }

  // Client-scoped fetch: returns all completed proposals for the given client
  if (params?.clientId !== undefined) {
    const items = await http.get<ProposalListApiItem[]>(`/proposals?client_id=${params.clientId}`, {
      cache: "no-store",
    });
    return items.map(mapProposalListItem);
  }

  // Page-based pagination: page + limit params (used by proposalSlice for infinite scroll)
  const page = params?.page ?? 1;
  const perPage = params?.limit ?? 100;
  const items = await http.get<ProposalListApiItem[]>(
    `/proposals?page=${page}&per_page=${perPage}`,
    { cache: "no-store" }
  );
  return items.map(mapProposalListItem);
}

export interface PaginatedProposalResponse {
  items: ProposalListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface ProposalHistoryDataResponse {
  data: ProposalListApiItem[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export async function listProposalHistory(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedProposalResponse> {
  const url = `/proposals/history?page=${page}&per_page=${perPage}`;
  // Note: http.get returns the unwrapped 'data' field from the API response
  const response = await http.get<ProposalHistoryDataResponse>(url, { cache: "no-store" });

  // Defensive check: ensure response has expected structure
  if (!response || !response.data || !Array.isArray(response.data)) {
    logger.error("[listProposalHistory] Invalid API response structure", { response });
    throw new Error("Invalid response from proposal history API");
  }

  if (!response.meta) {
    logger.error("[listProposalHistory] Missing meta in API response", { response });
    throw new Error("Missing pagination metadata in API response");
  }

  return {
    items: response.data.map(mapProposalListItem),
    page: response.meta.page,
    perPage: response.meta.per_page,
    total: response.meta.total,
    totalPages: response.meta.total_pages,
    hasMore: response.meta.page < response.meta.total_pages,
  };
}

export function getDownloadUrl(id: number): string {
  return buildUrl(`/proposals/${id}/download`);
}

export function getProposalPdfUrl(id: number): string {
  return buildUrl(`/proposals/${id}/download?format=pdf`);
}

export async function cancelProposal(id: number): Promise<void> {
  try {
    await http.post<null>(`/proposals/${id}/cancel`);
  } catch (error) {
    // Ignore 400 (already completed/failed) — cancellation is best-effort
    if (error instanceof HttpError && error.statusCode === 400) {
      return;
    }
    throw error;
  }
}

export async function updateApprovalStatus(
  proposalId: number,
  status: "pending" | "approved" | "rejected",
  signal?: AbortSignal
): Promise<ProposalData> {
  const endpoint = `/proposals/${proposalId}/approval-status`;
  const body = { approval_status: status };
  const raw = signal
    ? await http.patch<RawProposalApiResponse>(endpoint, body, { signal })
    : await http.patch<RawProposalApiResponse>(endpoint, body);
  return mapProposal(raw);
}
