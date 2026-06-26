"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Clock, Edit, Eye, FileDown, FileText, MoreVertical, Search, Trash2 } from "lucide-react";

import { formatDate } from "@/utils/dateUtils";
import { logger } from "@/utils/logger";
import { getTemplateTypeLabel } from "@/utils/proposalUtils";
import { toast } from "@/utils/toast";
import { useProposalDownload } from "@/hooks/useProposalDownload";
import type { useClientProposals } from "@/hooks/useClientProposals";
import styles from "../ClientDetailPage.module.scss";

const DeleteConfirmModal = dynamic(
  () => import("@/components/modals/DeleteConfirmModal/DeleteConfirmModal"),
  { ssr: false }
);

type ProposalsHook = ReturnType<typeof useClientProposals>;

type DeleteTarget =
  | { kind: "proposal"; id: number; title: string }
  | { kind: "draft"; id: string; title: string };

interface ClientProposalsListProps {
  proposals: ProposalsHook;
  onNewProposal: () => void;
}

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

// ---------------------------------------------------------------------------
// Row actions dropdown (3-dot menu)
// ---------------------------------------------------------------------------

interface RowMenuProps {
  menuId: string;
  openMenuId: string | null;
  onToggle: (id: string) => void;
  onClose: () => void;
  onDocx: () => void;
  onPdf: () => void;
  onDelete: () => void;
  isDocxLoading: boolean;
  isPdfLoading: boolean;
  disableDownloads?: boolean;
}

function RowActionsMenu({
  menuId,
  openMenuId,
  onToggle,
  onClose,
  onDocx,
  onPdf,
  onDelete,
  isDocxLoading,
  isPdfLoading,
  disableDownloads = false,
}: RowMenuProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpen = openMenuId === menuId;

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className={styles.rowMenuContainer}>
      <button
        className={styles.actionBtn}
        onClick={() => onToggle(menuId)}
        title="More actions"
        style={{ width: 32, height: 32, padding: 0, flexShrink: 0 }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div className={styles.rowMenu} role="menu">
          <button
            role="menuitem"
            disabled={disableDownloads || isDocxLoading}
            onClick={() => {
              onDocx();
              onClose();
            }}
          >
            {isDocxLoading ? <span className="spinner spinner-xs" /> : <FileDown size={14} />}
            {isDocxLoading ? "Downloading…" : "Download DOCX"}
          </button>

          <button
            role="menuitem"
            disabled={disableDownloads || isPdfLoading}
            onClick={() => {
              onPdf();
              onClose();
            }}
          >
            {isPdfLoading ? <span className="spinner spinner-xs" /> : <FileDown size={14} />}
            {isPdfLoading ? "Downloading…" : "Download PDF"}
          </button>

          <div className={styles.rowMenuDivider} />

          <button
            role="menuitem"
            className={styles.rowMenuDanger}
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
    handleDeleteProposal,
    handleDeleteDraft,
  } = proposals;

  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"" | "draft" | "approved" | "rejected">("");
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function handlePdfDownload(proposalId: number): Promise<void> {
    setDownloadingPdfId(proposalId);
    try {
      await downloadProposalPdf(proposalId);
    } finally {
      setDownloadingPdfId(null);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.kind === "proposal") {
        await handleDeleteProposal(deleteTarget.id);
      } else {
        await handleDeleteDraft(deleteTarget.id);
      }
      toast.success("Document deleted");
      setDeleteTarget(null);
    } catch (err) {
      logger.error("[ClientProposalsList] Delete failed:", err);
      toast.error("Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  }

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
                <th style={{ width: 64, minWidth: 64, textAlign: "center" }}>Preview</th>
                <th
                  className={styles.actionsCol}
                  style={{ width: 64, minWidth: 64, textAlign: "center" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedProposals.map((proposal) => {
                const menuId = `proposal-${proposal.id}`;
                const isDocxLoading = downloadingProposalId === proposal.id;
                const isPdfLoading = downloadingPdfId === proposal.id;

                return (
                  <tr key={menuId} className={styles.proposalRow}>
                    <td>
                      <div className={`${styles.proposalName} ${styles.cellWrap}`}>
                        {proposal.title}
                      </div>
                      {proposal.version != null && (
                        <div className={styles.proposalVersion}>v{proposal.version}</div>
                      )}
                    </td>
                    <td>
                      <span className={styles.typeBadge}>{getTemplateTypeLabel(proposal)}</span>
                    </td>
                    <td className={`${styles.dateCell} ${styles.cellWrap}`}>
                      {formatDate(proposal.createdAt)}
                    </td>
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
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => router.push(`/proposal/${proposal.id}`)}
                        title="View document"
                        style={{ width: 32, height: 32, padding: 0 }}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                    <td
                      className={styles.actionsCol}
                      style={{ textAlign: "center" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowActionsMenu
                        menuId={menuId}
                        openMenuId={openMenuId}
                        onToggle={(id) => setOpenMenuId(openMenuId === id ? null : id)}
                        onClose={() => setOpenMenuId(null)}
                        isDocxLoading={isDocxLoading}
                        isPdfLoading={isPdfLoading}
                        onDocx={() => void handleDownloadProposal(proposal.id)}
                        onPdf={() => void handlePdfDownload(proposal.id)}
                        onDelete={() =>
                          setDeleteTarget({
                            kind: "proposal",
                            id: proposal.id,
                            title: proposal.title,
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}

              {displayedDrafts.map((draft) => {
                const menuId = `draft-${draft.id}`;

                if (draft.proposalId !== null) {
                  const isDocxLoading = downloadingProposalId === draft.proposalId;
                  const isPdfLoading = downloadingPdfId === draft.proposalId;

                  return (
                    <tr key={menuId} className={styles.proposalRow}>
                      <td>
                        <div className={`${styles.proposalName} ${styles.cellWrap}`}>
                          {draft.title || "Untitled"}
                        </div>
                      </td>
                      <td>
                        <span className={styles.typeBadge}>
                          {getDraftTypeLabel(draft.templateType)}
                        </span>
                      </td>
                      <td className={`${styles.dateCell} ${styles.cellWrap}`}>
                        {formatDate(draft.updatedAt)}
                      </td>
                      <td>
                        <div className={styles.statusCell}>
                          <Clock size={16} className={styles.statusIconDraft} />
                          <span>Draft</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => router.push(`/proposal/${draft.proposalId}`)}
                          title="View document"
                          style={{ width: 32, height: 32, padding: 0 }}
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                      <td
                        className={styles.actionsCol}
                        style={{ textAlign: "center" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActionsMenu
                          menuId={menuId}
                          openMenuId={openMenuId}
                          onToggle={(id) => setOpenMenuId(openMenuId === id ? null : id)}
                          onClose={() => setOpenMenuId(null)}
                          isDocxLoading={isDocxLoading}
                          isPdfLoading={isPdfLoading}
                          onDocx={() => void handleDownloadProposal(draft.proposalId!)}
                          onPdf={() => void handlePdfDownload(draft.proposalId!)}
                          onDelete={() =>
                            setDeleteTarget({
                              kind: "proposal",
                              id: draft.proposalId!,
                              title: draft.title || "Untitled",
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                }

                // Draft with no linked proposal — in progress, downloads disabled
                return (
                  <tr key={menuId} className={styles.proposalRow}>
                    <td>
                      <div className={`${styles.proposalName} ${styles.cellWrap}`}>
                        {draft.title || "Untitled Draft"}
                      </div>
                      <div className={styles.proposalVersion}>In Progress</div>
                    </td>
                    <td>
                      <span className={styles.typeBadge}>
                        {getDraftTypeLabel(draft.templateType)}
                      </span>
                    </td>
                    <td className={`${styles.dateCell} ${styles.cellWrap}`}>
                      {formatDate(draft.updatedAt)}
                    </td>
                    <td>
                      <div className={styles.statusCell}>
                        <Edit size={16} className={styles.statusIconDraft} />
                        <span>Draft</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => router.push("/drafts")}
                        title="Resume draft"
                        style={{ width: 32, height: 32, padding: 0 }}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                    <td
                      className={styles.actionsCol}
                      style={{ textAlign: "center" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowActionsMenu
                        menuId={menuId}
                        openMenuId={openMenuId}
                        onToggle={(id) => setOpenMenuId(openMenuId === id ? null : id)}
                        onClose={() => setOpenMenuId(null)}
                        isDocxLoading={false}
                        isPdfLoading={false}
                        disableDownloads
                        onDocx={() => undefined}
                        onPdf={() => undefined}
                        onDelete={() =>
                          setDeleteTarget({
                            kind: "draft",
                            id: draft.id,
                            title: draft.title || "Untitled Draft",
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete Document"
          itemName={deleteTarget.title}
          warningMessage="This action cannot be undone. The document will be permanently removed."
          onClose={() => !isDeleting && setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
