import { http } from "@/config/httpClient";
import type {
  ProposalVersion,
  VersionHistory,
  CreateVersionPayload,
  UpdateVersionDecisionPayload,
  RegenerateFromVersionPayload,
} from "@/interfaces/versionInterfaces";
import type { RawProposalVersionSnapshot } from "@/interfaces/proposalInterfaces";
import { mapRawVersionSnapshot } from "@/interfaces/proposalInterfaces";

interface RawVersionApiResponse {
  id: string;
  proposal_id: number;
  version: number;
  source: string;
  decision: string;
  snapshot: RawProposalVersionSnapshot;
  created_at: string;
  created_by?: string;
  parent_version?: number;
  change_description?: string;
}

function mapVersion(v: RawVersionApiResponse): ProposalVersion {
  return {
    id: v.id,
    proposalId: v.proposal_id,
    version: v.version,
    source: v.source as ProposalVersion["source"],
    decision: v.decision as ProposalVersion["decision"],
    snapshot: mapRawVersionSnapshot(v.snapshot),
    createdAt: v.created_at,
    createdBy: v.created_by,
    parentVersion: v.parent_version,
    changeDescription: v.change_description,
  };
}

export async function getVersionHistory(
  proposalId: number
): Promise<VersionHistory> {
  const data = await http.get<{
    proposal_id: number;
    current_version: number;
    versions: RawVersionApiResponse[];
    accepted_versions: number[];
    rejected_versions: number[];
  }>(`/proposals/${proposalId}/versions/`, { cache: "no-store" });

  return {
    proposalId: data.proposal_id,
    currentVersion: data.current_version,
    versions: data.versions.map(mapVersion),
    acceptedVersions: data.accepted_versions,
    rejectedVersions: data.rejected_versions,
  };
}

export async function getVersion(versionId: string): Promise<ProposalVersion> {
  const data = await http.get<RawVersionApiResponse>(`/versions/${versionId}`, { cache: "no-store" });
  return mapVersion(data);
}

export async function createVersion(
  payload: CreateVersionPayload
): Promise<ProposalVersion> {
  const data = await http.post<RawVersionApiResponse>("/versions", {
    proposal_id: payload.proposalId,
    source: payload.source,
    snapshot: payload.snapshot,
    parent_version: payload.parentVersion,
    change_description: payload.changeDescription,
  });
  return mapVersion(data);
}

export async function updateVersionDecision(
  payload: UpdateVersionDecisionPayload
): Promise<ProposalVersion> {
  const data = await http.patch<RawVersionApiResponse>(
    `/versions/${payload.versionId}/decision/`,
    { decision: payload.decision }
  );
  return mapVersion(data);
}

export async function regenerateFromVersion(
  payload: RegenerateFromVersionPayload
): Promise<{ proposalId: number; versionId: string }> {
  const data = await http.post<{
    proposal_id: number;
    version_id: string;
  }>(`/versions/${payload.versionId}/regenerate/`, {
    modifications: payload.modifications,
  });

  return {
    proposalId: data.proposal_id,
    versionId: data.version_id,
  };
}

export async function saveEditedVersion(
  versionId: string,
  editedContent: Record<string, string>
): Promise<ProposalVersion> {
  const data = await http.post<RawVersionApiResponse>(`/versions/${versionId}/edit/`, {
    edited_content: editedContent,
  });
  return mapVersion(data);
}
