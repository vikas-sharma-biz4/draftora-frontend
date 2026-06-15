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
} from "@/interfaces/artifactInterfaces";

// ---------------------------------------------------------------------------
// Internal snake_case API shapes (not exported)
// ---------------------------------------------------------------------------

interface ArtifactApiShape {
  id: number;
  client_id: number;
  proposal_id: number;
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
  const body = {
    client_id: data.clientId,
    proposal_id: data.proposalId,
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
  };

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
