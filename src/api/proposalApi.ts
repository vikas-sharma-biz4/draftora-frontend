import { API_BASE_URL } from "@/config/config";
import type { ProposalData, ProposalListItem, TemplateType } from "@/types/proposal.types";

// ngrok free tier shows an HTML interstitial page for browser fetch requests.
// This header bypasses it so API calls get JSON responses instead of HTML.
const BASE_HEADERS: Record<string, string> = {
  "ngrok-skip-browser-warning": "1",
};

interface CreateProposalResponse {
  id: number;
  status: string;
}

interface RegenerateResponse {
  section_key: string;
  content: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.success) {
    const message: string =
      json?.error?.message ?? `Request failed with status ${res.status}`;
    console.error("API Error Details:", {
      status: res.status,
      statusText: res.statusText,
      json,
      error: json?.error
    });
    throw new Error(message);
  }
  return json.data as T;
}

export async function generateProposal(
  data: ProposalData
): Promise<CreateProposalResponse> {
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

  const proposalPayload = {
    title: data.title,
    client_name: data.clientName,
    description: data.description,
    tone: data.tone,
    length_preference: data.lengthPreference,
    language: data.language,
    ai_model: data.aiModel ?? "gpt-4o",
    selected_sections: allSections,
    section_display_names: Object.keys(sectionDisplayNames).length > 0 ? sectionDisplayNames : null,
    contextual_instructions: contextual || null,
    web_references: data.webReferences,
  };

  formData.append("proposal_data", JSON.stringify(proposalPayload));

  for (const file of data.files) {
    formData.append("files", file);
  }

  const res = await fetch(`${API_BASE_URL}/proposals/`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: formData,
  });

  return handleResponse<CreateProposalResponse>(res);
}

export interface ProposalStatus {
  id: number;
  status: string;
  generatingSection: string | null;
  completedSections: string[];
  selectedSections: string[] | null;
}

export async function getProposalStatus(id: number): Promise<ProposalStatus> {
  const res = await fetch(`${API_BASE_URL}/proposals/${id}/status/`, {
    cache: "no-store",
    headers: BASE_HEADERS,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message ?? "Failed to fetch proposal status");
  }
  const d = json.data;
  return {
    id: d.id,
    status: d.status,
    generatingSection: d.generating_section ?? null,
    completedSections: d.completed_sections ?? [],
    selectedSections: d.selected_sections ?? null,
  };
}

export async function getProposal(id: number): Promise<ProposalData> {
  if (isNaN(id)) {
    throw new Error("Invalid proposal ID");
  }
  const res = await fetch(`${API_BASE_URL}/proposals/${id}/`, {
    cache: "no-store",
    headers: BASE_HEADERS,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message ?? "Failed to fetch proposal");
  }
  const d = json.data;
  return {
    id: d.id,
    title: d.title,
    clientName: d.client_name,
    description: d.description ?? "",
    tone: d.tone,
    lengthPreference: d.length_preference,
    language: d.language,
    aiModel: d.ai_model ?? "gpt-4o",
    selectedSections: d.selected_sections ?? [],
    sectionDisplayNames: (d.section_display_names ?? {}) as Record<string, string>,
    customSections: [],
    contextualInstructions: d.contextual_instructions ?? "",
    webReferences: d.web_references ?? [],
    files: [],
    templateId: d.template_id ?? null,
    templateType: (d.template_type ?? "scratch") as TemplateType,
    status: d.status,
    sections: d.sections ?? {},
    sectionTypes: (d.section_types ?? {}) as Record<string, string>,
    generatingSection: d.generating_section ?? null,
    mermaidDiagram: d.mermaid_diagram ?? undefined,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    approvalStatus: (d.approval_status ?? "pending") as "pending" | "approved" | "rejected",
  };
}

export async function updateSection(
  id: number,
  sectionKey: string,
  content: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/proposals/${id}/sections/${sectionKey}/`,
    {
      method: "PUT",
      headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
  await handleResponse<null>(res);
}

export async function regenerateSection(
  id: number,
  sectionKey: string,
  instructions?: string
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/proposals/${id}/regenerate/`, {
    method: "POST",
    headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      section_key: sectionKey,
      additional_instructions: instructions ?? null,
    }),
  });
  const data = await handleResponse<RegenerateResponse>(res);
  return data.content;
}

export async function listProposals(): Promise<ProposalListItem[]> {
  const res = await fetch(`${API_BASE_URL}/proposals/`, { cache: "no-store", headers: BASE_HEADERS });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message ?? "Failed to list proposals");
  }
  return (json.data as Array<Record<string, unknown>>).map((item) => ({
    id: item.id as number,
    title: item.title as string,
    clientName: item.client_name as string,
    status: item.status as string,
    tone: item.tone as string,
    lengthPreference: item.length_preference as string,
    createdAt: item.created_at as string,
    updatedAt: item.updated_at as string,
  }));
}

export function getDownloadUrl(id: number): string {
  return `${API_BASE_URL}/proposals/${id}/download/`;
}

export async function cancelProposal(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/proposals/${id}/cancel/`, {
    method: "POST",
    headers: BASE_HEADERS,
  });
  // Ignore 400 (already completed/failed) — cancellation is best-effort
  if (!res.ok && res.status !== 400) {
    await handleResponse<null>(res);
  }
}

// ── Section Management ─────────────────────────────────────────────────────────

export interface AddSectionPayload {
  section_key: string;
  label: string;
  content?: string;
}

export interface ReorderSectionsPayload {
  order: string[];
  section_display_names?: Record<string, string>;
}

export async function addProposalSection(
  id: number,
  payload: AddSectionPayload
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/proposals/${id}/sections/`, {
    method: "POST",
    headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse<null>(res);
}

export async function removeProposalSection(
  id: number,
  sectionKey: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/proposals/${id}/sections/${sectionKey}/`,
    { method: "DELETE", headers: BASE_HEADERS }
  );
  await handleResponse<null>(res);
}

export async function reorderProposalSections(
  id: number,
  payload: ReorderSectionsPayload
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/proposals/${id}/sections/reorder/`, {
    method: "PATCH",
    headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse<null>(res);
}

// ── Section Suggestion ─────────────────────────────────────────────────────────

export interface SuggestSectionsPayload {
  title: string;
  description: string;
  template_type: string;
  context?: string;
}

export interface SuggestedSection {
  key: string;
  label: string;
  description: string;
}

export async function suggestSections(
  payload: SuggestSectionsPayload
): Promise<SuggestedSection[]> {
  const res = await fetch(`${API_BASE_URL}/proposals/suggest-sections/`, {
    method: "POST",
    headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ sections: SuggestedSection[] }>(res);
  return data.sections;
}

// ── Template Parsing ───────────────────────────────────────────────────────────

export interface ExtractedTemplateSection {
  key: string;
  label: string;
  description: string;
}

export interface ParseTemplateResult {
  sections: ExtractedTemplateSection[];
  sourceType: string;
  totalSections: number;
}

export async function parseCustomTemplate(
  file: File
): Promise<ParseTemplateResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/templates/parse/`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: formData,
  });
  const data = await handleResponse<{
    sections: Array<{ key: string; label: string; description: string }>;
    source_type: string;
    total_sections: number;
  }>(res);
  return {
    sections: data.sections,
    sourceType: data.source_type,
    totalSections: data.total_sections,
  };
}

// ── Parse Feature ─────────────────────────────────────────────────────────────

export interface ParsedFileResult {
  filename: string;
  extension: string;
  sizeBytes: number;
  charCount: number;
  wordCount: number;
  preview: string;
  text: string;
}

export interface ParseFilesResponse {
  success: boolean;
  message: string;
  filesReceived: number;
  filesParsed: number;
  results: ParsedFileResult[];
  errors: Array<{ filename: string; error: string }>;
}

/**
 * Upload one or more files to the backend parsing engine (Docling + OCR).
 * Returns extracted text content per file.
 */
export async function parseFiles(files: File[]): Promise<ParseFilesResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(`${API_BASE_URL}/parse/`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: formData,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.detail ?? `Parse request failed (${res.status})`);
  }

  // Map snake_case fields from backend to camelCase
  return {
    success: json.success as boolean,
    message: json.message as string,
    filesReceived: json.files_received as number,
    filesParsed: json.files_parsed as number,
    results: (json.results as Array<Record<string, unknown>>).map((r) => ({
      filename: r.filename as string,
      extension: r.extension as string,
      sizeBytes: r.size_bytes as number,
      charCount: r.char_count as number,
      wordCount: r.word_count as number,
      preview: r.preview as string,
      text: r.text as string,
    })),
    errors: (json.errors ?? []) as Array<{ filename: string; error: string }>,
  };
}

/**
 * Fetch the list of file extensions supported by the backend parser.
 */
export async function getSupportedParseFormats(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/parse/supported-formats/`, {
    cache: "no-store",
    headers: BASE_HEADERS,
  });
  const json = await res.json();
  return (json?.data?.extensions ?? []) as string[];
}

// ── Follow-up Document Generation (BRD/FRD/Architecture) ─────────────────────

export interface GenerateFollowUpDocumentPayload {
  document_type: "brd" | "frd" | "architecture";
  additional_instructions?: string;
}

export interface GenerateFollowUpDocumentResponse {
  id?: number;
  status?: string;
  document_content?: string;
  document_type?: string;
}

/**
 * Generate a follow-up document (BRD, FRD, or Architecture) from an existing proposal.
 * BRD is generated from pre-sale proposal.
 * FRD is generated from BRD.
 * Architecture is generated from FRD.
 */
export async function generateFollowUpDocument(
  sourceProposalId: number,
  payload: GenerateFollowUpDocumentPayload
): Promise<GenerateFollowUpDocumentResponse> {
  const res = await fetch(`${API_BASE_URL}/proposals/${sourceProposalId}/generate-follow-up/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<GenerateFollowUpDocumentResponse>(res);
}

// ── Approval Status Management ─────────────────────────────────────────────

export interface UpdateApprovalStatusPayload {
  approval_status: "pending" | "approved" | "rejected";
}

/**
 * Update the approval status of a proposal (for BRD/FRD workflow).
 */
export async function updateApprovalStatus(
  id: number,
  payload: UpdateApprovalStatusPayload
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/proposals/${id}/approval-status/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse<null>(res);
}
