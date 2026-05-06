import { API_BASE_URL } from "@/config/config";
import type {
  ProposalVersion,
  VersionHistory,
  CreateVersionPayload,
  UpdateVersionDecisionPayload,
  RegenerateFromVersionPayload,
} from "@/types/version.types";

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

if (process.env.NODE_ENV === "development") {
  BASE_HEADERS["ngrok-skip-browser-warning"] = "1";
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.success) {
    const message: string =
      json?.error?.message ?? `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return json.data as T;
}

export async function getVersionHistory(
  proposalId: number
): Promise<VersionHistory> {
  const res = await fetch(`${API_BASE_URL}/proposals/${proposalId}/versions/`, {
    cache: "no-store",
    headers: BASE_HEADERS,
  });

  const data = await handleResponse<{
    proposal_id: number;
    current_version: number;
    versions: Array<{
      id: string;
      proposal_id: number;
      version: number;
      source: string;
      decision: string;
      snapshot: Record<string, unknown>;
      created_at: string;
      created_by?: string;
      parent_version?: number;
      change_description?: string;
    }>;
    accepted_versions: number[];
    rejected_versions: number[];
  }>(res);

  return {
    proposalId: data.proposal_id,
    currentVersion: data.current_version,
    versions: data.versions.map((v) => ({
      id: v.id,
      proposalId: v.proposal_id,
      version: v.version,
      source: v.source as ProposalVersion["source"],
      decision: v.decision as ProposalVersion["decision"],
      snapshot: v.snapshot as unknown as ProposalVersion["snapshot"],
      createdAt: v.created_at,
      createdBy: v.created_by,
      parentVersion: v.parent_version,
      changeDescription: v.change_description,
    })),
    acceptedVersions: data.accepted_versions,
    rejectedVersions: data.rejected_versions,
  };
}

export async function getVersion(versionId: string): Promise<ProposalVersion> {
  const res = await fetch(`${API_BASE_URL}/versions/${versionId}/`, {
    cache: "no-store",
    headers: BASE_HEADERS,
  });

  const data = await handleResponse<{
    id: string;
    proposal_id: number;
    version: number;
    source: string;
    decision: string;
    snapshot: Record<string, unknown>;
    created_at: string;
    created_by?: string;
    parent_version?: number;
    change_description?: string;
  }>(res);

  return {
    id: data.id,
    proposalId: data.proposal_id,
    version: data.version,
    source: data.source as ProposalVersion["source"],
    decision: data.decision as ProposalVersion["decision"],
    snapshot: data.snapshot as unknown as ProposalVersion["snapshot"],
    createdAt: data.created_at,
    createdBy: data.created_by,
    parentVersion: data.parent_version,
    changeDescription: data.change_description,
  };
}

export async function createVersion(
  payload: CreateVersionPayload
): Promise<ProposalVersion> {
  const res = await fetch(`${API_BASE_URL}/versions/`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: JSON.stringify({
      proposal_id: payload.proposalId,
      source: payload.source,
      snapshot: payload.snapshot,
      parent_version: payload.parentVersion,
      change_description: payload.changeDescription,
    }),
  });

  const data = await handleResponse<{
    id: string;
    proposal_id: number;
    version: number;
    source: string;
    decision: string;
    snapshot: Record<string, unknown>;
    created_at: string;
    created_by?: string;
    parent_version?: number;
    change_description?: string;
  }>(res);

  return {
    id: data.id,
    proposalId: data.proposal_id,
    version: data.version,
    source: data.source as ProposalVersion["source"],
    decision: data.decision as ProposalVersion["decision"],
    snapshot: data.snapshot as unknown as ProposalVersion["snapshot"],
    createdAt: data.created_at,
    createdBy: data.created_by,
    parentVersion: data.parent_version,
    changeDescription: data.change_description,
  };
}

export async function updateVersionDecision(
  payload: UpdateVersionDecisionPayload
): Promise<ProposalVersion> {
  const res = await fetch(
    `${API_BASE_URL}/versions/${payload.versionId}/decision/`,
    {
      method: "PATCH",
      headers: BASE_HEADERS,
      body: JSON.stringify({
        decision: payload.decision,
      }),
    }
  );

  const data = await handleResponse<{
    id: string;
    proposal_id: number;
    version: number;
    source: string;
    decision: string;
    snapshot: Record<string, unknown>;
    created_at: string;
    created_by?: string;
    parent_version?: number;
    change_description?: string;
  }>(res);

  return {
    id: data.id,
    proposalId: data.proposal_id,
    version: data.version,
    source: data.source as ProposalVersion["source"],
    decision: data.decision as ProposalVersion["decision"],
    snapshot: data.snapshot as unknown as ProposalVersion["snapshot"],
    createdAt: data.created_at,
    createdBy: data.created_by,
    parentVersion: data.parent_version,
    changeDescription: data.change_description,
  };
}

export async function regenerateFromVersion(
  payload: RegenerateFromVersionPayload
): Promise<{ proposalId: number; versionId: string }> {
  const res = await fetch(
    `${API_BASE_URL}/versions/${payload.versionId}/regenerate/`,
    {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({
        modifications: payload.modifications,
      }),
    }
  );

  const data = await handleResponse<{
    proposal_id: number;
    version_id: string;
  }>(res);

  return {
    proposalId: data.proposal_id,
    versionId: data.version_id,
  };
}

export async function saveEditedVersion(
  versionId: string,
  editedContent: Record<string, string>
): Promise<ProposalVersion> {
  const res = await fetch(`${API_BASE_URL}/versions/${versionId}/edit/`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: JSON.stringify({
      edited_content: editedContent,
    }),
  });

  const data = await handleResponse<{
    id: string;
    proposal_id: number;
    version: number;
    source: string;
    decision: string;
    snapshot: Record<string, unknown>;
    created_at: string;
    created_by?: string;
    parent_version?: number;
    change_description?: string;
  }>(res);

  return {
    id: data.id,
    proposalId: data.proposal_id,
    version: data.version,
    source: data.source as ProposalVersion["source"],
    decision: data.decision as ProposalVersion["decision"],
    snapshot: data.snapshot as unknown as ProposalVersion["snapshot"],
    createdAt: data.created_at,
    createdBy: data.created_by,
    parentVersion: data.parent_version,
    changeDescription: data.change_description,
  };
}
