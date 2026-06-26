"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  FileDown,
  FileText,
  MoreVertical,
  Paperclip,
  Search,
  Trash2,
  X,
  Download,
} from "lucide-react";

import {
  updateArtifact,
  deleteArtifact,
  uploadPaymentProof,
  getPaymentProofUrl,
} from "@/services/artifact.service";
import { formatDate } from "@/utils/dateUtils";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { MESSAGES } from "@/constants/messages";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";
import InvoicePreviewModal from "@/components/modals/InvoicePreviewModal/InvoicePreviewModal";
import { useClientInvoicesQuery, clientInvoicesQueryKey } from "@/hooks/useClientInvoicesQuery";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";

import styles from "../ClientDetailPage.module.scss";
import panelStyles from "./InvoiceHistoryPanel.module.scss";

const DeleteConfirmModal = dynamic(
  () => import("@/components/modals/DeleteConfirmModal/DeleteConfirmModal"),
  { ssr: false }
);

interface InvoiceHistoryPanelProps {
  clientId: number;
  onGenerateInvoice: () => void;
}

function extractTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Payment proof viewer modal
// ---------------------------------------------------------------------------

interface PaymentProofViewerProps {
  artifactId: number;
  filename: string;
  onClose: () => void;
}

function PaymentProofViewerModal({
  artifactId,
  filename,
  onClose,
}: PaymentProofViewerProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  const isPdf = ext === "pdf";
  const needsPreview = isImage || isPdf;

  const proofUrl = getPaymentProofUrl(artifactId);

  function handleDownload(): void {
    window.open(proofUrl, "_blank", "noopener,noreferrer");
  }

  return createPortal(
    <div
      className={panelStyles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={panelStyles.proofViewerModal} role="dialog" aria-modal="true">
        <div className={panelStyles.modalHeader}>
          <h3>Payment Proof</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className={panelStyles.proofDownloadBtn}
              onClick={handleDownload}
              title="Download proof"
            >
              <Download size={15} />
            </button>
            <button className={panelStyles.modalClose} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className={panelStyles.proofViewerBody}>
          {isLoading && needsPreview && <span className="spinner spinner-md" />}

          {loadError && (
            <div className={panelStyles.proofUnsupported}>
              <p>Failed to load proof. You can still download it.</p>
              <button className={panelStyles.confirmBtn} onClick={handleDownload}>
                <Download size={14} />
                {`Download ${filename}`}
              </button>
            </div>
          )}

          {!loadError && isImage && (
            <img
              src={proofUrl}
              alt="Payment proof"
              className={panelStyles.proofImage}
              style={{ display: isLoading ? "none" : "block" }}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setLoadError(true);
              }}
            />
          )}

          {!loadError && isPdf && (
            <iframe
              src={proofUrl}
              className={panelStyles.proofPdfFrame}
              title="Payment proof PDF"
              onLoad={() => setIsLoading(false)}
            />
          )}

          {!needsPreview && (
            <div className={panelStyles.proofUnsupported}>
              <p>Preview not available for this file type.</p>
              <button className={panelStyles.confirmBtn} onClick={handleDownload}>
                <Download size={14} />
                {`Download ${filename}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Mark-Paid confirmation modal (inline, portal-rendered)
// ---------------------------------------------------------------------------

interface MarkPaidModalProps {
  invoice: GeneratedArtifact;
  onClose: () => void;
  onConfirm: (file: File | null) => Promise<void>;
  isSubmitting: boolean;
}

function MarkPaidModal({
  invoice,
  onClose,
  onConfirm,
  isSubmitting,
}: MarkPaidModalProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invoiceNumber =
    (invoice.metadataJson?.invoice_number as string | undefined) ?? invoice.title;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
  }

  return createPortal(
    <div className={panelStyles.modalOverlay}>
      <div className={panelStyles.modal} role="dialog" aria-modal="true">
        <div className={panelStyles.modalHeader}>
          <h3>Mark as Paid</h3>
          <button className={panelStyles.modalClose} onClick={onClose} disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>
        <div className={panelStyles.modalBody}>
          <p>
            Mark <strong>{invoiceNumber}</strong> as paid?
          </p>
          <p className={panelStyles.modalSubtext}>
            Optionally attach payment proof (image, PDF, or DOCX).
          </p>

          <div className={panelStyles.fileUploadArea}>
            {file ? (
              <div className={panelStyles.fileSelected}>
                <Paperclip size={14} />
                <span title={file.name}>{file.name}</span>
                <button
                  className={panelStyles.fileRemoveBtn}
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                className={panelStyles.filePickBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={14} />
                Attach payment proof
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        </div>
        <div className={panelStyles.modalFooter}>
          <button className={panelStyles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className={panelStyles.confirmBtn}
            onClick={() => void onConfirm(file)}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Confirm Paid"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Invoice row 3-dot actions menu
// ---------------------------------------------------------------------------

interface InvoiceRowMenuProps {
  menuId: string;
  openMenuId: string | null;
  onToggle: (id: string) => void;
  onClose: () => void;
  onDocx: () => void;
  onPdf: () => void;
  onDelete: () => void;
  isDocxLoading: boolean;
  isPdfLoading: boolean;
}

function InvoiceRowMenu({
  menuId,
  openMenuId,
  onToggle,
  onClose,
  onDocx,
  onPdf,
  onDelete,
  isDocxLoading,
  isPdfLoading,
}: InvoiceRowMenuProps): JSX.Element {
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
            disabled={isDocxLoading}
            onClick={() => {
              onDocx();
            }}
          >
            {isDocxLoading ? <span className="spinner spinner-xs" /> : <FileDown size={14} />}
            {isDocxLoading ? "Downloading…" : "Download DOCX"}
          </button>

          <button
            role="menuitem"
            disabled={isPdfLoading}
            onClick={() => {
              onPdf();
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
// Main panel
// ---------------------------------------------------------------------------

export default function InvoiceHistoryPanel({
  clientId,
  onGenerateInvoice,
}: InvoiceHistoryPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const { invoices, isLoading } = useClientInvoicesQuery(clientId);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [previewArtifact, setPreviewArtifact] = useState<GeneratedArtifact | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<GeneratedArtifact | null>(null);
  const [downloadingDocxId, setDownloadingDocxId] = useState<number | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);

  // Mark-paid modal state
  const [markPaidInvoice, setMarkPaidInvoice] = useState<GeneratedArtifact | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Proof viewer state
  const [proofViewArtifact, setProofViewArtifact] = useState<GeneratedArtifact | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { downloadArtifact, downloadArtifactPdf } = useArtifactDownload();

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  async function handleToggleStatus(artifact: GeneratedArtifact): Promise<void> {
    const currentStatus = (artifact.metadataJson?.payment_status as string | undefined) ?? "Unpaid";

    if (currentStatus === "Unpaid") {
      // Intercept: show confirmation modal instead of immediately toggling
      setMarkPaidInvoice(artifact);
      return;
    }

    // Paid → Unpaid: toggle directly without modal
    setTogglingId(artifact.id);
    try {
      const updated = await updateArtifact(artifact.id, {
        content: artifact.content,
        metadataJson: { ...(artifact.metadataJson ?? {}), payment_status: "Unpaid" },
      });
      queryClient.setQueryData(
        clientInvoicesQueryKey(clientId),
        (old: GeneratedArtifact[] | undefined) =>
          (old ?? []).map((inv) => (inv.id === updated.id ? updated : inv))
      );
    } catch (err) {
      logger.error("[InvoiceHistoryPanel] Status toggle failed:", err);
      toast.error(MESSAGES.INVOICE_STATUS_UPDATE_FAILED);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirmMarkPaid(file: File | null): Promise<void> {
    if (!markPaidInvoice) return;
    setIsMarkingPaid(true);
    try {
      let latestArtifact = markPaidInvoice;

      // Upload proof first if provided
      if (file) {
        latestArtifact = await uploadPaymentProof(markPaidInvoice.id, file);
      }

      // Update payment status to Paid in both metadataJson (drives the UI badge)
      // and the content HTML (drives DOCX/PDF downloads which use stored content).
      const paidContent = latestArtifact.content.replace(/>Unpaid</g, ">Paid<");
      const updated = await updateArtifact(markPaidInvoice.id, {
        content: paidContent,
        metadataJson: { ...(latestArtifact.metadataJson ?? {}), payment_status: "Paid" },
      });

      queryClient.setQueryData(
        clientInvoicesQueryKey(clientId),
        (old: GeneratedArtifact[] | undefined) =>
          (old ?? []).map((inv) => (inv.id === updated.id ? updated : inv))
      );
      toast.success("Invoice marked as paid");
      setMarkPaidInvoice(null);
    } catch (err) {
      logger.error("[InvoiceHistoryPanel] Mark paid failed:", err);
      toast.error("Failed to mark invoice as paid");
    } finally {
      setIsMarkingPaid(false);
    }
  }

  function handleDelete(inv: GeneratedArtifact): void {
    setInvoiceToDelete(inv);
  }

  async function confirmDeleteInvoice(): Promise<void> {
    if (!invoiceToDelete) return;
    try {
      await deleteArtifact(invoiceToDelete.id);
      queryClient.setQueryData(
        clientInvoicesQueryKey(clientId),
        (old: GeneratedArtifact[] | undefined) =>
          (old ?? []).filter((i) => i.id !== invoiceToDelete.id)
      );
      toast.success("Invoice deleted");
      setInvoiceToDelete(null);
    } catch (err) {
      logger.error("[InvoiceHistoryPanel] Delete failed:", err);
      toast.error("Failed to delete invoice");
    }
  }

  async function handleDocxDownload(inv: GeneratedArtifact): Promise<void> {
    setDownloadingDocxId(inv.id);
    try {
      await downloadArtifact(inv.id, inv.title);
      await queryClient.invalidateQueries({ queryKey: clientInvoicesQueryKey(clientId) });
    } finally {
      setDownloadingDocxId(null);
      setOpenMenuId(null);
    }
  }

  async function handlePdfDownload(inv: GeneratedArtifact): Promise<void> {
    setDownloadingPdfId(inv.id);
    try {
      await downloadArtifactPdf(inv.id, inv.title);
      await queryClient.invalidateQueries({ queryKey: clientInvoicesQueryKey(clientId) });
    } finally {
      setDownloadingPdfId(null);
      setOpenMenuId(null);
    }
  }

  const displayedInvoices = invoices.filter((inv) => {
    const meta = inv.metadataJson ?? {};
    const job = ((meta.job_to_be_done as string | undefined) ?? "").toLowerCase();
    if (searchQuery && !job.includes(searchQuery.toLowerCase())) return false;
    if (dateFrom) {
      const invLocalDate = new Date(inv.createdAt).toLocaleDateString("en-CA");
      if (invLocalDate !== dateFrom) return false;
    }
    return true;
  });

  // Totals are always computed from the full list (all invoices, not filtered)
  const paidTotal = invoices.reduce((sum, inv) => {
    const status = (inv.metadataJson?.payment_status as string | undefined) ?? "Unpaid";
    const amount = (inv.metadataJson?.total_amount as number | undefined) ?? 0;
    return status === "Paid" ? sum + amount : sum;
  }, 0);

  const unpaidTotal = invoices.reduce((sum, inv) => {
    const status = (inv.metadataJson?.payment_status as string | undefined) ?? "Unpaid";
    const amount = (inv.metadataJson?.total_amount as number | undefined) ?? 0;
    return status !== "Paid" ? sum + amount : sum;
  }, 0);

  return (
    <>
      <div className={styles.invoiceHistory}>
        <div className={styles.panelTopRow}>
          <div>
            <h2 className={styles.panelTitle}>Invoice History</h2>
            <p className={styles.panelSubtitle}>All generated invoices and payment status</p>
          </div>
          <div className={styles.headerActions}>
            <button className="btn btn-secondary btn-sm" onClick={onGenerateInvoice}>
              <FileText size={14} />
              Generate Invoice
            </button>
          </div>
        </div>

        <div className={styles.panelSearchRow}>
          <div className={styles.searchInputFull}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by job…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <input
            type="date"
            className={styles.dateInput}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
          />
        </div>

        {isLoading ? (
          <div className={styles.emptyState}>
            <p>Loading invoices…</p>
          </div>
        ) : displayedInvoices.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={48} />
            <p>No invoices yet</p>
            <p>Generate an invoice to get started</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.proposalTable}>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Job</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th
                    className={styles.actionsCol}
                    style={{ width: 90, minWidth: 90, textAlign: "center" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedInvoices.map((inv) => {
                  const meta = inv.metadataJson ?? {};
                  const invoiceNumber = (meta.invoice_number as string | undefined) ?? "—";
                  const jobToBeDone = (meta.job_to_be_done as string | undefined) ?? "—";
                  const totalAmount = (meta.total_amount as number | undefined) ?? 0;
                  const paymentStatus = (meta.payment_status as string | undefined) ?? "Unpaid";
                  const hasProof = Boolean(meta.payment_proof_s3_key);

                  const isDocxLoading = downloadingDocxId === inv.id;
                  const isPdfLoading = downloadingPdfId === inv.id;

                  return (
                    <tr key={inv.id} className={styles.proposalRow}>
                      <td>
                        <div className={styles.proposalName}>{invoiceNumber}</div>
                      </td>
                      <td>
                        <div
                          className={styles.proposalName}
                          style={{ wordBreak: "break-word" }}
                          title={jobToBeDone}
                        >
                          {jobToBeDone}
                        </div>
                      </td>
                      <td className={styles.dateCell}>{formatDate(inv.createdAt)}</td>
                      <td className={styles.dateCell}>{extractTime(inv.createdAt)}</td>
                      <td>
                        <strong>
                          ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                        </strong>
                      </td>
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleStatus(inv);
                        }}
                      >
                        <div className={panelStyles.statusCell}>
                          <span
                            className={`${styles.paymentStatus} ${
                              paymentStatus === "Paid"
                                ? styles.paymentStatusPaid
                                : styles.paymentStatusUnpaid
                            }`}
                            title={`Click to mark as ${paymentStatus === "Paid" ? "Unpaid" : "Paid"}`}
                            style={{ cursor: togglingId === inv.id ? "wait" : "pointer" }}
                          >
                            {togglingId === inv.id ? "…" : paymentStatus}
                          </span>
                          {hasProof && paymentStatus === "Paid" && (
                            <button
                              className={panelStyles.proofBtn}
                              title="View payment proof"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProofViewArtifact(inv);
                              }}
                            >
                              <Paperclip size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td
                        className={styles.actionsCol}
                        style={{ width: 90, minWidth: 90, textAlign: "center" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className={styles.invoiceActions}>
                          {/* Preview */}
                          <button
                            className={styles.actionBtn}
                            onClick={() => setPreviewArtifact(inv)}
                            title="View invoice"
                            style={{ width: 32, height: 32, padding: 0, flexShrink: 0 }}
                          >
                            <Eye size={18} />
                          </button>

                          {/* 3-dot actions menu */}
                          <InvoiceRowMenu
                            menuId={`inv-${inv.id}`}
                            openMenuId={openMenuId}
                            onToggle={(id) => setOpenMenuId(openMenuId === id ? null : id)}
                            onClose={() => setOpenMenuId(null)}
                            isDocxLoading={isDocxLoading}
                            isPdfLoading={isPdfLoading}
                            onDocx={() => void handleDocxDownload(inv)}
                            onPdf={() => void handlePdfDownload(inv)}
                            onDelete={() => handleDelete(inv)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paid / Unpaid totals — always shown when there are invoices */}
        {!isLoading && invoices.length > 0 && (
          <div className={panelStyles.totalsRow}>
            <div className={panelStyles.totalCard}>
              <span className={panelStyles.totalLabel}>Paid Total</span>
              <span className={panelStyles.totalValuePaid}>
                ${paidTotal.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className={panelStyles.totalCard}>
              <span className={panelStyles.totalLabel}>Unpaid Total</span>
              <span className={panelStyles.totalValueUnpaid}>
                ${unpaidTotal.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        )}
      </div>

      {markPaidInvoice && (
        <MarkPaidModal
          invoice={markPaidInvoice}
          onClose={() => setMarkPaidInvoice(null)}
          onConfirm={handleConfirmMarkPaid}
          isSubmitting={isMarkingPaid}
        />
      )}

      {proofViewArtifact && (
        <PaymentProofViewerModal
          artifactId={proofViewArtifact.id}
          filename={String(proofViewArtifact.metadataJson?.payment_proof_filename ?? "proof")}
          onClose={() => setProofViewArtifact(null)}
        />
      )}

      {previewArtifact && (
        <InvoicePreviewModal artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
      )}

      {invoiceToDelete && (
        <DeleteConfirmModal
          title="Delete Invoice"
          itemName={
            (invoiceToDelete.metadataJson?.invoice_number as string | undefined) ??
            invoiceToDelete.title
          }
          warningMessage="This action cannot be undone. The invoice will be permanently removed."
          onClose={() => setInvoiceToDelete(null)}
          onConfirm={confirmDeleteInvoice}
        />
      )}
    </>
  );
}
