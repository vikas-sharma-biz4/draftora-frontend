/**
 * Artifact generation API service.
 *
 * All API shapes use snake_case to match the FastAPI backend contract.
 * Responses are transformed to camelCase before being returned to callers.
 */

import { http, buildUrl } from "@/config/httpClient";
import type {
  ArtifactGenerateRequest,
  ArtifactUpdateRequest,
  GeneratedArtifact,
  MilestoneCost,
} from "@/interfaces/artifactInterfaces";
import type { RegenerateSelectionResult } from "@/services/proposal/proposalSections.service";

// ---------------------------------------------------------------------------
// Internal snake_case API shapes (not exported)
// ---------------------------------------------------------------------------

interface ArtifactApiShape {
  id: number;
  client_id: number;
  proposal_id: number | null;
  template_id: string;
  artifact_type: string;
  title: string;
  content: string;
  version: number;
  metadata_json: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

function transformArtifact(api: ArtifactApiShape): GeneratedArtifact {
  return {
    id: api.id,
    clientId: api.client_id,
    proposalId: api.proposal_id,
    templateId: api.template_id,
    artifactType: api.artifact_type as GeneratedArtifact["artifactType"],
    title: api.title,
    content: api.content,
    version: api.version,
    metadataJson: api.metadata_json,
    createdBy: api.created_by,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Generate a new artifact version.
 * Uses a 60-second timeout to accommodate LLM generation latency.
 */
export async function generateArtifact(data: ArtifactGenerateRequest): Promise<GeneratedArtifact> {
  const body: Record<string, unknown> = {
    client_id: data.clientId,
    proposal_id: data.proposalId ?? null,
    template_id: data.templateId,
    artifact_type: data.artifactType,
    title: data.title,
    additional_instructions: data.additionalInstructions ?? null,
    options: data.options
      ? {
          include_summary: data.options.includeSummary,
          include_scope: data.options.includeScope,
          include_strengths: data.options.includeStrengths,
          include_podcast: data.options.includePodcast,
        }
      : undefined,
    created_by: data.createdBy ?? null,
    client_name: data.clientName ?? null,
  };

  if (data.invoiceMetadata) {
    const totalAmount = data.invoiceMetadata.milestoneCosts.reduce((sum, mc) => sum + mc.amount, 0);
    body.invoice_metadata = {
      invoice_number: data.invoiceMetadata.invoiceNumber,
      invoice_date: data.invoiceMetadata.invoiceDate,
      client_name: data.invoiceMetadata.clientName,
      company_name: data.invoiceMetadata.companyName || null,
      job_to_be_done: data.invoiceMetadata.jobToBeDone,
      milestone_costs: data.invoiceMetadata.milestoneCosts.map((mc: MilestoneCost) => ({
        milestone: mc.milestone,
        amount: mc.amount,
      })),
      total_amount: totalAmount,
    };
  }

  if (data.ndaMetadata) {
    body.nda_metadata = {
      client_name: data.ndaMetadata.clientName,
      client_company: data.ndaMetadata.clientCompany,
      date: data.ndaMetadata.date,
    };
  }

  const result = await http.post<ArtifactApiShape>("/artifacts/generate", body, {
    requestTimeout: 60_000,
  });
  return transformArtifact(result);
}

/**
 * List artifacts with optional filters.
 */
export async function listArtifacts(params: {
  clientId?: number;
  proposalId?: number;
  artifactType?: string;
}): Promise<GeneratedArtifact[]> {
  const query = new URLSearchParams();
  if (params.clientId !== undefined) query.set("client_id", String(params.clientId));
  if (params.proposalId !== undefined) query.set("proposal_id", String(params.proposalId));
  if (params.artifactType !== undefined) query.set("artifact_type", params.artifactType);

  const path = `/artifacts${query.toString() ? `?${query.toString()}` : ""}`;
  const results = await http.get<ArtifactApiShape[]>(path);
  return results.map(transformArtifact);
}

/**
 * Update the content of an existing artifact (manual edits / save draft).
 */
export async function updateArtifact(
  artifactId: number,
  data: ArtifactUpdateRequest
): Promise<GeneratedArtifact> {
  const body: Record<string, unknown> = { content: data.content };
  if (data.title !== undefined) body.title = data.title;
  if (data.metadataJson !== undefined) body.metadata_json = data.metadataJson;

  const result = await http.put<ArtifactApiShape>(`/artifacts/${artifactId}`, body);
  return transformArtifact(result);
}

/**
 * Return the DOCX download URL for an artifact.
 * Used by useArtifactDownload hook (raw fetch with streaming).
 */
export function getArtifactDownloadUrl(artifactId: number): string {
  return buildUrl(`/artifacts/${artifactId}/download?format=docx`);
}

/**
 * Return the PDF download URL for an artifact.
 * Uses Playwright on the backend for high-quality rendering.
 */
export function getArtifactPdfUrl(artifactId: number): string {
  return buildUrl(`/artifacts/${artifactId}/download?format=pdf`);
}

/**
 * Regenerate a user-selected text span within an artifact using AI.
 * Returns the same RegenerateSelectionResult shape used by the RichEditor's
 * onRegenerateSelection prop, so it can be passed directly as the handler.
 */
export async function regenerateArtifactSelection(
  artifactId: number,
  params: {
    selectedText: string;
    selectionContext?: string;
    instructions?: string;
  }
): Promise<RegenerateSelectionResult> {
  interface RegenApiShape {
    regenerated_text: string;
    format: string | null;
  }
  const data = await http.post<RegenApiShape>(
    `/artifacts/${artifactId}/regenerate-selection`,
    {
      selected_text: params.selectedText,
      selection_context: params.selectionContext ?? null,
      instructions: params.instructions ?? null,
    },
    { requestTimeout: 45_000 }
  );
  return { regeneratedText: data.regenerated_text, format: data.format ?? null };
}

/**
 * Fetch milestones for a proposal — used to pre-populate the invoice form.
 */
export async function getMilestones(proposalId: number): Promise<string[]> {
  interface MilestonesApiShape {
    proposal_id: number;
    milestones: string[];
  }
  const result = await http.get<MilestonesApiShape>(
    `/artifacts/milestones?proposal_id=${proposalId}`
  );
  return result.milestones;
}
