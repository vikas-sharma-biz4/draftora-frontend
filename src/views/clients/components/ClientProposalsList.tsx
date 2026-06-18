"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, FileDown, CheckCircle, Clock, Edit, X, Eye } from "lucide-react";

import { formatDate } from "@/utils/dateUtils";
import { getTemplateTypeLabel } from "@/utils/proposalUtils";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import type { useClientProposals } from "@/hooks/useClientProposals";
import styles from "../ClientDetailPage.module.scss";

type ProposalsHook = ReturnType<typeof useClientProposals>;

interface ClientProposalsListProps {
  proposals: ProposalsHook;
  onNewProposal: () => void;
}

// Maps raw draft.templateType values to consistent display labels.
// These match what DraftMetadata.templateType holds (e.g. "mvp", "design", "full").
const DRAFT_TYPE_LABELS: Record<string, string> = {
  mvp: "MVP",
  poc: "POC",
  design: "Design (IP)",
  full: "Full Proposal",
  brd: "BRD",
  frd: "FRD",
  srs: "SRS",
  sow: "SOW",
  architecture: "Architecture",
  scratch: "From Scratch",
  predefined: "Template",
  custom: "Custom",
};

function getDraftTypeLabel(templateType: string | undefined): string {
  if (!templateType) return "Draft";
  return DRAFT_TYPE_LABELS[templateType.toLowerCase()] ?? templateType;
}

export default function ClientProposalsList({
  proposals,
  onNewProposal,
}: ClientProposalsListProps): JSX.Element {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { isPdfDownloading, downloadArtifactPdf } = useArtifactDownload();

  const {
    proposalSearchQuery,
    setProposalSearchQuery,
    isLoadingProposals,
    downloadingProposalId,
    filteredProposals,
    filteredDraftRows,
    handleDownloadProposal,
  } = proposals;

  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"" | "draft" | "approved" | "rejected">("");
  const [openMenuId, setOpenMenuId] = useState<number | string | null>(null);

  // Build unique type list from BOTH proposals and drafts so the filter
  // is always populated regardless of which document types exist.
  const uniqueTypes = [
    ...new Set([
      ...filteredProposals.map((p) => getTemplateTypeLabel(p)),
      ...filteredDraftRows.map((d) => getDraftTypeLabel(d.templateType)),
    ]),
  ].sort();

  // Apply type + status filters to proposals
  const displayedProposals = (
    selectedType
      ? filteredProposals.filter((p) => getTemplateTypeLabel(p) === selectedType)
      : filteredProposals
  ).filter((p) => {
    if (!selectedStatus) return true;
    if (selectedStatus === "draft") return p.approvalStatus === "pending";
    return p.approvalStatus === selectedStatus;
  });

  // Apply type + status filters to drafts (drafts are always "Draft" status)
  const displayedDrafts = (
    selectedType
      ? filteredDraftRows.filter((d) => getDraftTypeLabel(d.templateType) === selectedType)
      : filteredDraftRows
  ).filter(() => !selectedStatus || selectedStatus === "draft");

  // Close 3-dot menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasNoDocuments = filteredProposals.length === 0 && filteredDraftRows.length === 0;
  const hasNoResults = displayedProposals.length === 0 && displayedDrafts.length === 0;

  return (
    <div className={styles.proposalHistory}>
      {/* Row 1: title + action button */}
      <div className={styles.panelTopRow}>
        <h2 className={styles.panelTitle}>Generated Documents</h2>
        <button className="btn btn-primary btn-sm" onClick={onNewProposal}>
          New Document
        </button>
      </div>

      {/* Row 2: search + filter */}
      <div className={styles.panelSearchRow}>
        <div className={styles.searchInputFull}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search documents..."
            value={proposalSearchQuery}
            onChange={(e) => setProposalSearchQuery(e.target.value)}
          />
        </div>
        {!isLoadingProposals && uniqueTypes.length > 0 && (
          <select
            className={styles.filterSelect}
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setOpenMenuId(null);
            }}
            aria-label="Filter by type"
          >
            <option value="" disabled hidden>
              Filter
            </option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {!isLoadingProposals && (
          <select
            className={styles.filterSelect}
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as typeof selectedStatus);
              setOpenMenuId(null);
            }}
            aria-label="Filter by status"
          >
            <option value="" disabled hidden>
              Status
            </option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
      </div>

      {isLoadingProposals ? (
        <div className={styles.emptyState}>
          <p>Loading documents…</p>
        </div>
      ) : hasNoDocuments ? (
        <div className={styles.emptyState}>
          <FileText size={48} />
          <p>No documents yet</p>
          <p>Generate a proposal to get started</p>
        </div>
      ) : hasNoResults ? (
        <div className={styles.emptyState}>
          <FileText size={32} />
          <p>No documents match the selected filter</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.proposalTable} style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Document Name</th>
                <th>Type</th>
                <th>Date</th>
                <th>Status</th>
                <th className={styles.actionsCol}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedProposals.map((proposal) => (
                <tr
                  key={`proposal-${proposal.id}`}
                  className={styles.proposalRow}
                  onClick={() => router.push(`/proposal/${proposal.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <div className={styles.proposalName}>{proposal.title}</div>
                    {proposal.version != null && (
                      <div className={styles.proposalVersion}>v{proposal.version}</div>
                    )}
                  </td>
                  <td>
                    <span className={styles.typeBadge}>{getTemplateTypeLabel(proposal)}</span>
                  </td>
                  <td className={styles.dateCell}>{formatDate(proposal.createdAt)}</td>
                  <td>
                    <div className={styles.statusCell}>
                      {proposal.approvalStatus === "approved" && (
                        <>
                          <CheckCircle size={16} className={styles.statusIconFinalized} />
                          <span>Approved</span>
                        </>
                      )}
                      {proposal.approvalStatus === "rejected" && (
                        <>
                          <X size={16} className={styles.statusIconReview} />
                          <span className={styles.statusReview}>Rejected</span>
                        </>
                      )}
                      {proposal.approvalStatus === "pending" && (
                        <>
                          <Clock size={16} className={styles.statusIconDraft} />
                          <span>Draft</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.invoiceActions}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => router.push(`/proposal/${proposal.id}`)}
                        title="View document"
                      >
                        <Eye size={15} />
                      </button>
                      <div
                        className={styles.threeDotWrap}
                        ref={openMenuId === proposal.id ? menuRef : null}
                      >
                        <button
                          className={styles.actionBtn}
                          onClick={() =>
                            setOpenMenuId((id) => (id === proposal.id ? null : proposal.id))
                          }
                          title="Download"
                          disabled={downloadingProposalId === proposal.id || isPdfDownloading}
                        >
                          <FileDown size={15} />
                        </button>
                        {openMenuId === proposal.id && (
                          <div className={styles.actionMenu}>
                            <button
                              className={styles.actionMenuItem}
                              onClick={() => {
                                setOpenMenuId(null);
                                void handleDownloadProposal(proposal.id);
                              }}
                              disabled={downloadingProposalId === proposal.id}
                            >
                              <FileDown size={14} />
                              Download DOCX
                            </button>
                            <button
                              className={styles.actionMenuItem}
                              onClick={() => {
                                setOpenMenuId(null);
                                void downloadArtifactPdf(proposal.id, proposal.title);
                              }}
                              disabled={isPdfDownloading}
                            >
                              <FileDown size={14} />
                              Download PDF
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}

              {displayedDrafts.map((draft) => (
                <tr
                  key={`draft-${draft.id}`}
                  className={styles.proposalRow}
                  onClick={() => router.push("/drafts")}
                  style={{ cursor: "pointer" }}
                  title="View in Drafts"
                >
                  <td>
                    <div className={styles.proposalName}>{draft.title || "Untitled Draft"}</div>
                    <div className={styles.proposalVersion}>In Progress</div>
                  </td>
                  <td>
                    {/* Use getDraftTypeLabel for consistent matching with the filter */}
                    <span className={styles.typeBadge}>
                      {getDraftTypeLabel(draft.templateType)}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{formatDate(draft.updatedAt)}</td>
                  <td>
                    <div className={styles.statusCell}>
                      <Edit size={16} className={styles.statusIconDraft} />
                      <span>Draft</span>
                    </div>
                  </td>
                  <td className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.invoiceActions}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => router.push("/drafts")}
                        title="Resume draft"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        className={styles.actionBtn}
                        disabled
                        title="Draft cannot be downloaded yet"
                      >
                        <FileDown size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
