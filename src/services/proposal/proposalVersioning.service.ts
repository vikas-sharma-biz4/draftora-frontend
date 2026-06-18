/**
 * Proposal versioning service
 *
 * Handles the three versioning API endpoints:
 * - POST /proposals/{id}/create-version-draft — branch a new draft from History
 * - GET  /proposals/{id}/family              — retrieve the full version family tree
 * - DELETE /proposals/{id}/version-draft     — soft-delete a pending version draft
 */

import { http } from "@/config/httpClient";
import type {
  FamilyTreeItem,
  ProposalFamilyTree,
  VersionDraftOut,
  VersionDraftTrigger,
} from "@/interfaces/proposalInterfaces";

// ── Raw API shapes (snake_case) ───────────────────────────────────────────────

interface RawVersionDraftOut {
  id: number;
  version_label: string;
  parent_proposal_id: number;
  root_proposal_id: number;
  approval_status: string;
  status: string;
  title: string;
  created_at: string;
}

interface RawFamilyTreeItem {
  id: number;
  version_label: string;
  approval_status: string;
  status: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface RawFamilyTreeResponse {
  root_id: number;
  versions: RawFamilyTreeItem[];
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapVersionDraftOut(raw: RawVersionDraftOut): VersionDraftOut {
  return {
    id: raw.id,
    versionLabel: raw.version_label,
    parentProposalId: raw.parent_proposal_id,
    rootProposalId: raw.root_proposal_id,
    approvalStatus: raw.approval_status,
    status: raw.status,
    title: raw.title,
    createdAt: raw.created_at,
  };
}

function mapFamilyTreeItem(raw: RawFamilyTreeItem): FamilyTreeItem {
  return {
    id: raw.id,
    versionLabel: raw.version_label,
    approvalStatus: raw.approval_status,
    status: raw.status,
    title: raw.title,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Branch a new pending draft from a History (approved or rejected) proposal.
 *
 * Creates a sibling draft when trigger is "duplicate" (copies content from the
 * source's own parent family), or a child draft for all other triggers.
 *
 * @param proposalId - PK of the History proposal to branch from.
 * @param trigger    - Reason for creating the draft.
 * @returns          The newly created pending proposal (version draft).
 */
export async function createVersionDraft(
  proposalId: number,
  trigger: VersionDraftTrigger
): Promise<VersionDraftOut> {
  const raw = await http.post<RawVersionDraftOut>(`/proposals/${proposalId}/create-version-draft`, {
    trigger,
  });
  return mapVersionDraftOut(raw);
}

/**
 * Retrieve the full version family tree for any proposal in the family.
 *
 * @param proposalId - PK of any proposal in the family (root or child).
 * @returns          Family tree with root_id and ordered version list.
 */
export async function getProposalFamilyTree(proposalId: number): Promise<ProposalFamilyTree> {
  const raw = await http.get<RawFamilyTreeResponse>(`/proposals/${proposalId}/family`, {
    cache: "no-store",
  });
  return {
    rootId: raw.root_id,
    versions: raw.versions.map(mapFamilyTreeItem),
  };
}

/**
 * Soft-delete a pending version draft.
 *
 * Only proposals with approval_status='pending' and a non-null
 * parent_proposal_id can be deleted through this path. Sibling drafts are
 * automatically renumbered by the backend after deletion.
 *
 * @param proposalId - PK of the pending version draft to delete.
 */
export async function deleteVersionDraft(proposalId: number): Promise<void> {
  await http.delete<null>(`/proposals/${proposalId}/version-draft`);
}
