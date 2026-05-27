/**
 * Proposal CRUD operations
 *
 * Create, read, list, download, cancel, and approval status management.
 */

import { DEFAULT_AI_MODEL } from "@/config/config";
import { http, buildUrl, HttpError } from "@/config/httpClient";
import type { ProposalData, ProposalListItem, ToneOption, LengthOption, TemplateType } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";

const ALLOWED_UPLOAD_EXTENSIONS = ["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt"];
const MAX_UPLOAD_SIZE_MB = 50;

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
  const valid: TemplateType[] = ["predefined", "custom", "scratch", "recreate"];
  if (raw && (valid as string[]).includes(raw)) return raw as TemplateType;
  return "scratch";
}

interface CreateProposalResponse {
  id: number;
  status: string;
  jobId?: string | null;
}

export async function generateProposal(
  data: ProposalData
): Promise<CreateProposalResponse> {
  logger.info("[generateProposal] Starting proposal generation request at", new Date().toISOString());
  const startTime = Date.now();

  const formData = new FormData();

  // Build contextual instructions — append custom section descriptions so the AI
  // knows what content to produce for user-defined sections.
  let contextual = data.contextualInstructions ?? "";
  if (data.customSections.length > 0) {
    const customBlock = data.customSections
      .map((s) => `- "${s.label}": ${s.description}`)
      .join("\n");
    const separator = contextual.trim() ? "\n\n" : "";
    contextual += `${separator}[Additional custom sections to include in the proposal]:\n${customBlock}`;
  }

  const allSections = [
    ...data.selectedSections,
    ...data.customSections.map((s) => s.key),
  ];

  // Merge section display names: custom sections + any from template parsing
  const sectionDisplayNames: Record<string, string> = {
    ...data.sectionDisplayNames,
    ...Object.fromEntries(data.customSections.map((s) => [s.key, s.label])),
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

  // Recreate mode: pass original section contents for per-section rewrite prompts
  if (data.templateType === "recreate" && data.originalSectionContents) {
    proposalPayload["original_section_contents"] = data.originalSectionContents;
  }

  formData.append("proposal_data", JSON.stringify(proposalPayload));

  for (const file of data.files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      throw new Error(
        `Unsupported file type: "${file.name}". Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}`
      );
    }
    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      throw new Error(
        `File too large: "${file.name}". Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`
      );
    }
    formData.append("files", file);
  }

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
    logger.warn("[generateProposal] API call took longer than 1 second:", requestDuration, "ms - Backend may be doing synchronous generation");
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
  } else if (progressPercent === 0 && totalSections > 0 && completed.length === 0 && d.status === "generating") {
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
  created_at: string;
  updated_at: string;
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
    files: [],
    filesMeta: [],
    templateId: null,
    templateType: parseTemplateType(d.template_type),
    status: d.status,
    approvalStatus: d.approval_status ?? "pending",
    sections: d.sections ?? {},
    sectionTypes: d.section_types ?? {},
    generatingSection: d.generating_section ?? null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

export async function getProposal(id: number): Promise<ProposalData> {
  const d = await http.get<RawProposalApiResponse>(`/proposals/${id}`, {
    cache: "no-store",
  });
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
}

export interface ListProposalsParams {
  limit?: number;
  offset?: number;
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
  };
}

export async function listProposals(params?: ListProposalsParams): Promise<ProposalListItem[]> {
  // If explicit limit/offset params are passed, use them directly (legacy behaviour)
  if (params?.limit !== undefined || params?.offset !== undefined) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set("per_page", String(params.limit));
    if (params.offset) queryParams.set("page", String(Math.floor((params.offset ?? 0) / (params.limit ?? 10)) + 1));
    const url = `/proposals?${queryParams.toString()}`;
    const raw = await http.get<ProposalListApiItem[]>(url, { cache: "no-store" });
    return raw.map(mapProposalListItem);
  }

  // Fetch only the first page (100 items max) to avoid multiple sequential API calls.
  // This is optimized for performance - if you need all proposals, use pagination params.
  const PER_PAGE = 100;
  const items = await http.get<ProposalListApiItem[]>(
    `/proposals?page=1&per_page=${PER_PAGE}`,
    { cache: "no-store" },
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
    logger.error('[listProposalHistory] Invalid API response structure', { response });
    throw new Error('Invalid response from proposal history API');
  }

  if (!response.meta) {
    logger.error('[listProposalHistory] Missing meta in API response', { response });
    throw new Error('Missing pagination metadata in API response');
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
  status: "pending" | "approved" | "rejected"
): Promise<ProposalData> {
  const raw = await http.patch<RawProposalApiResponse>(
    `/proposals/${proposalId}/approval-status`,
    { approval_status: status }
  );
  return mapProposal(raw);
}
