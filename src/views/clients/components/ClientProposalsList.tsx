"use client";

import { useRouter } from "next/navigation";
import { Search, FileText, FileDown, CheckCircle, Clock, Edit, X } from "lucide-react";
import { formatDate } from "@/utils/dateUtils";
import { getTemplateTypeLabel } from "@/utils/proposalUtils";
import type { useClientProposals } from "@/hooks/useClientProposals";
import styles from "../ClientDetailPage.module.scss";

type ProposalsHook = ReturnType<typeof useClientProposals>;

interface ClientProposalsListProps {
  proposals: ProposalsHook;
  onNewProposal: () => void;
}

export default function ClientProposalsList({
  proposals,
  onNewProposal,
}: ClientProposalsListProps): JSX.Element {
  const router = useRouter();

  const {
    proposalSearchQuery,
    setProposalSearchQuery,
    isLoadingProposals,
    downloadingProposalId,
    filteredProposals,
    filteredDraftRows,
    handleDownloadProposal,
  } = proposals;

  return (
    <div className={styles.proposalHistory}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Proposal History</h2>
          <p className={styles.panelSubtitle}>Recent outputs and generated drafts</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchInput}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search proposals..."
              value={proposalSearchQuery}
              onChange={(e) => setProposalSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={onNewProposal}>
            New Proposal
          </button>
        </div>
      </div>

      {isLoadingProposals ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Loading proposals...</div>
        </div>
      ) : filteredProposals.length === 0 && filteredDraftRows.length === 0 ? (
        <div className={styles.emptyState}>
          <FileText size={48} />
          <p>No proposals yet</p>
          <p>Create a proposal to get started</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.proposalTable}>
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
              {filteredProposals.map((proposal) => (
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
                  <td className={styles.actionsCol}>
                    <div className={styles.actionsCol}>
                      <button
                        className={styles.actionBtn}
                        style={{ minWidth: "80px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDownloadProposal(proposal.id);
                        }}
                        disabled={downloadingProposalId === proposal.id}
                        title="Download as Word Document"
                      >
                        {downloadingProposalId === proposal.id ? (
                          <div className="flex items-center gap-2 justify-center">
                            <span
                              className="spinner spinner-white"
                              style={{ width: 14, height: 14 }}
                            />
                            <span className={styles.actionLabel}>Downloading...</span>
                          </div>
                        ) : (
                          <>
                            <FileDown size={16} />
                            <span className={styles.actionLabel}>DOCX</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredDraftRows.map((draft) => (
                <tr
                  key={`draft-${draft.id}`}
                  className={styles.proposalRow}
                  onClick={() => router.push("/drafts")}
                  style={{ cursor: "pointer" }}
                  title="View in Drafts"
                >
                  <td>
                    <div className={styles.proposalName}>{draft.title || "Untitled Draft"}</div>
                    <div
                      className={styles.proposalVersion}
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      In Progress
                    </div>
                  </td>
                  <td>
                    <span className={styles.typeBadge}>
                      {draft.templateType === "scratch" || !draft.templateType
                        ? "From Scratch"
                        : draft.templateType}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{formatDate(draft.updatedAt)}</td>
                  <td>
                    <div className={styles.statusCell}>
                      <Edit size={16} className={styles.statusIconDraft} />
                      <span>Draft</span>
                    </div>
                  </td>
                  <td className={styles.actionsCol}>
                    <div className={styles.actionsCol}>
                      <button
                        className={styles.actionBtn}
                        style={{ minWidth: "80px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push("/drafts");
                        }}
                        title="Resume editing this draft"
                      >
                        <Edit size={16} />
                        <span className={styles.actionLabel}>Resume</span>
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
