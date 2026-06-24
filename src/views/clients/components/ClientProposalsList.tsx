"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, FileDown, Clock, Edit, Eye } from "lucide-react";

import { formatDate } from "@/utils/dateUtils";
import { getTemplateTypeLabel } from "@/utils/proposalUtils";
import { useProposalDownload } from "@/hooks/useProposalDownload";
import CircularProgress from "@/components/common/CircularProgress";
import type { useClientProposals } from "@/hooks/useClientProposals";
import styles from "../ClientDetailPage.module.scss";

type ProposalsHook = ReturnType<typeof useClientProposals>;

interface ClientProposalsListProps {
  proposals: ProposalsHook;
  onNewProposal: () => void;
}

// Maps raw draft.templateType values to consistent display labels.
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
  const { downloadProposalPdf, pdfProgress } = useProposalDownload();

  const {
    proposalSearchQuery,
    setProposalSearchQuery,
    isLoadingProposals,
    downloadingProposalId,
    docxProgress,
    filteredProposals,
    filteredDraftRows,
    handleDownloadProposal,
  } = proposals;

  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"" | "draft" | "approved" | "rejected">("");
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);

  async function handlePdfDownload(proposalId: number): Promise<void> {
    setDownloadingPdfId(proposalId);
    try {
      await downloadProposalPdf(proposalId);
    } finally {
      setDownloadingPdfId(null);
    }
  }

  // Build unique type list from both proposals and drafts
  const uniqueTypes = [
    ...new Set([
      ...filteredProposals.map((p) => getTemplateTypeLabel(p)),
      ...filteredDraftRows.map((d) => getDraftTypeLabel(d.templateType)),
    ]),
  ].sort();

  const displayedProposals = (
    selectedType
      ? filteredProposals.filter((p) => getTemplateTypeLabel(p) === selectedType)
      : filteredProposals
  ).filter((p) => {
    if (!selectedStatus) return true;
    if (selectedStatus === "draft") return p.approvalStatus === "pending";
    return p.approvalStatus === selectedStatus;
  });

  const displayedDrafts = (
    selectedType
      ? filteredDraftRows.filter((d) => getDraftTypeLabel(d.templateType) === selectedType)
      : filteredDraftRows
  ).filter(() => !selectedStatus || selectedStatus === "draft");

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

      {/* Row 2: search + filters */}
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
            onChange={(e) => setSelectedType(e.target.value)}
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
            onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
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
                <th
                  className={styles.actionsCol}
                  style={{ width: 130, minWidth: 130, textAlign: "center" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedProposals.map((proposal) => {
                const isDocxLoading = downloadingProposalId === proposal.id;
                const isPdfLoading = downloadingPdfId === proposal.id;
                const docxPct = isDocxLoading ? (docxProgress ?? -1) : -1;
                const pdfPct = isPdfLoading ? (pdfProgress ?? -1) : -1;

                return (
                  <tr key={`proposal-${proposal.id}`} className={styles.proposalRow}>
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
                        {proposal.approvalStatus === "approved" && <span>Approved</span>}
                        {proposal.approvalStatus === "rejected" && (
                          <span className={styles.statusReview}>Rejected</span>
                        )}
                        {proposal.approvalStatus === "pending" && (
                          <>
                            <Clock size={16} className={styles.statusIconDraft} />
                            <span>Draft</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td
                      className={styles.actionsCol}
                      style={{ width: 130, minWidth: 130, textAlign: "center" }}
                    >
                      <div className={styles.invoiceActions}>
                        {/* View */}
                        <button
                          className={styles.actionBtn}
                          onClick={() => router.push(`/proposal/${proposal.id}`)}
                          title="View document"
                          style={{ width: 40, height: 40, padding: 0, flexShrink: 0 }}
                        >
                          <Eye size={18} />
                        </button>

                        {/* Download DOCX */}
                        <div className={styles.downloadBtnWrap}>
                          <button
                            className={styles.actionBtn}
                            onClick={() => void handleDownloadProposal(proposal.id)}
                            disabled={isDocxLoading}
                            title="Download DOCX"
                            style={{ flexDirection: "column", gap: 2, padding: "4px 6px" }}
                          >
                            <FileDown size={15} />
                            <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                              DOCX
                            </span>
                          </button>
                          {isDocxLoading && (
                            <CircularProgress
                              size={40}
                              strokeWidth={2.5}
                              indeterminate={docxPct < 0}
                              progress={Math.max(docxPct, 0)}
                              overlay
                            />
                          )}
                        </div>

                        {/* Download PDF */}
                        <div className={styles.downloadBtnWrap}>
                          <button
                            className={styles.actionBtn}
                            onClick={() => void handlePdfDownload(proposal.id)}
                            disabled={isPdfLoading}
                            title="Download PDF"
                            style={{ flexDirection: "column", gap: 2, padding: "4px 6px" }}
                          >
                            <FileDown size={15} />
                            <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>PDF</span>
                          </button>
                          {isPdfLoading && (
                            <CircularProgress
                              size={40}
                              strokeWidth={2.5}
                              indeterminate={pdfPct < 0}
                              progress={Math.max(pdfPct, 0)}
                              overlay
                            />
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {displayedDrafts.map((draft) => {
                // Draft with a linked proposal — proposal exists in DB but may not be in
                // the local store cache yet. Treat it as a generated document.
                if (draft.proposalId !== null) {
                  const isDocxLoading = downloadingProposalId === draft.proposalId;
                  const isPdfLoading = downloadingPdfId === draft.proposalId;
                  const docxPct = isDocxLoading ? (docxProgress ?? -1) : -1;
                  const pdfPct = isPdfLoading ? (pdfProgress ?? -1) : -1;

                  return (
                    <tr key={`draft-${draft.id}`} className={styles.proposalRow}>
                      <td>
                        <div className={styles.proposalName}>{draft.title || "Untitled"}</div>
                      </td>
                      <td>
                        <span className={styles.typeBadge}>
                          {getDraftTypeLabel(draft.templateType)}
                        </span>
                      </td>
                      <td className={styles.dateCell}>{formatDate(draft.updatedAt)}</td>
                      <td>
                        <div className={styles.statusCell}>
                          <Clock size={16} className={styles.statusIconDraft} />
                          <span>Draft</span>
                        </div>
                      </td>
                      <td className={styles.actionsCol} style={{ width: 130, minWidth: 130 }}>
                        <div className={styles.invoiceActions}>
                          <button
                            className={styles.actionBtn}
                            onClick={() => router.push(`/proposal/${draft.proposalId}`)}
                            title="View document"
                            style={{ width: 40, height: 40, padding: 0, flexShrink: 0 }}
                          >
                            <Eye size={18} />
                          </button>
                          <div className={styles.downloadBtnWrap}>
                            <button
                              className={styles.actionBtn}
                              onClick={() => void handleDownloadProposal(draft.proposalId!)}
                              disabled={isDocxLoading}
                              title="Download DOCX"
                              style={{ flexDirection: "column", gap: 2, padding: "4px 6px" }}
                            >
                              <FileDown size={15} />
                              <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                                DOCX
                              </span>
                            </button>
                            {isDocxLoading && (
                              <CircularProgress
                                size={40}
                                strokeWidth={2.5}
                                indeterminate={docxPct < 0}
                                progress={Math.max(docxPct, 0)}
                                overlay
                              />
                            )}
                          </div>
                          <div className={styles.downloadBtnWrap}>
                            <button
                              className={styles.actionBtn}
                              onClick={() => void handlePdfDownload(draft.proposalId!)}
                              disabled={isPdfLoading}
                              title="Download PDF"
                              style={{ flexDirection: "column", gap: 2, padding: "4px 6px" }}
                            >
                              <FileDown size={15} />
                              <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                                PDF
                              </span>
                            </button>
                            {isPdfLoading && (
                              <CircularProgress
                                size={40}
                                strokeWidth={2.5}
                                indeterminate={pdfPct < 0}
                                progress={Math.max(pdfPct, 0)}
                                overlay
                              />
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Draft with no linked proposal — still in progress, cannot download
                return (
                  <tr key={`draft-${draft.id}`} className={styles.proposalRow}>
                    <td>
                      <div className={styles.proposalName}>{draft.title || "Untitled Draft"}</div>
                      <div className={styles.proposalVersion}>In Progress</div>
                    </td>
                    <td>
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
                    <td
                      className={styles.actionsCol}
                      style={{ width: 130, minWidth: 130, textAlign: "center" }}
                    >
                      <div className={styles.invoiceActions}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => router.push("/drafts")}
                          title="Resume draft"
                          style={{ width: 40, height: 40, padding: 0, flexShrink: 0 }}
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          className={styles.actionBtn}
                          disabled
                          title="Draft cannot be downloaded yet"
                          style={{ flexDirection: "column", gap: 2, padding: "4px 6px" }}
                        >
                          <FileDown size={15} />
                          <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>DOCX</span>
                        </button>
                        <button
                          className={styles.actionBtn}
                          disabled
                          title="Draft cannot be downloaded yet"
                          style={{ flexDirection: "column", gap: 2, padding: "4px 6px" }}
                        >
                          <FileDown size={15} />
                          <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
