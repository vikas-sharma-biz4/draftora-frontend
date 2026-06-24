"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, FileDown, Search } from "lucide-react";

import { updateArtifact } from "@/services/artifact.service";
import { formatDate } from "@/utils/dateUtils";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { MESSAGES } from "@/constants/messages";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";
import InvoicePreviewModal from "@/components/modals/InvoicePreviewModal/InvoicePreviewModal";
import { useClientInvoicesQuery, clientInvoicesQueryKey } from "@/hooks/useClientInvoicesQuery";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import CircularProgress from "@/components/common/CircularProgress";

import styles from "../ClientDetailPage.module.scss";

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

export default function InvoiceHistoryPanel({
  clientId,
  onGenerateInvoice,
}: InvoiceHistoryPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const { invoices, isLoading } = useClientInvoicesQuery(clientId);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [previewArtifact, setPreviewArtifact] = useState<GeneratedArtifact | null>(null);
  const [downloadingDocxId, setDownloadingDocxId] = useState<number | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);

  const { downloadArtifact, docxProgress, downloadArtifactPdf, pdfProgress } =
    useArtifactDownload();

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  async function handleToggleStatus(artifact: GeneratedArtifact): Promise<void> {
    const currentStatus = (artifact.metadataJson?.payment_status as string | undefined) ?? "Unpaid";
    const nextStatus = currentStatus === "Paid" ? "Unpaid" : "Paid";
    setTogglingId(artifact.id);
    try {
      const updated = await updateArtifact(artifact.id, {
        content: artifact.content,
        metadataJson: { ...(artifact.metadataJson ?? {}), payment_status: nextStatus },
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

  async function handleDocxDownload(inv: GeneratedArtifact): Promise<void> {
    setDownloadingDocxId(inv.id);
    try {
      await downloadArtifact(inv.id, inv.title);
      // Refresh metadata so the eye button can use the newly stored S3 key.
      await queryClient.invalidateQueries({ queryKey: clientInvoicesQueryKey(clientId) });
    } finally {
      setDownloadingDocxId(null);
    }
  }

  async function handlePdfDownload(inv: GeneratedArtifact): Promise<void> {
    setDownloadingPdfId(inv.id);
    try {
      await downloadArtifactPdf(inv.id, inv.title);
      // Refresh metadata so the eye button can use the newly stored S3 key.
      await queryClient.invalidateQueries({ queryKey: clientInvoicesQueryKey(clientId) });
    } finally {
      setDownloadingPdfId(null);
    }
  }

  const displayedInvoices = invoices.filter((inv) => {
    const meta = inv.metadataJson ?? {};
    const job = ((meta.job_to_be_done as string | undefined) ?? "").toLowerCase();
    if (searchQuery && !job.includes(searchQuery.toLowerCase())) return false;
    if (dateFrom) {
      const invLocalDate = new Date(inv.createdAt).toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local timezone
      if (invLocalDate !== dateFrom) return false;
    }
    return true;
  });

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
                    style={{ width: 130, minWidth: 130, textAlign: "center" }}
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

                  const isDocxLoading = downloadingDocxId === inv.id;
                  const isPdfLoading = downloadingPdfId === inv.id;
                  const docxPct = isDocxLoading ? (docxProgress ?? -1) : -1;
                  const pdfPct = isPdfLoading ? (pdfProgress ?? -1) : -1;

                  return (
                    <tr key={inv.id} className={styles.proposalRow}>
                      <td>
                        <div className={styles.proposalName}>{invoiceNumber}</div>
                      </td>
                      <td>
                        <div
                          className={styles.proposalName}
                          style={{
                            maxWidth: 160,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
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
                      </td>
                      <td
                        className={styles.actionsCol}
                        style={{ width: 130, minWidth: 130, textAlign: "center" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className={styles.invoiceActions}>
                          {/* View */}
                          <button
                            className={styles.actionBtn}
                            onClick={() => setPreviewArtifact(inv)}
                            title="View invoice"
                            style={{ width: 40, height: 40, padding: 0, flexShrink: 0 }}
                          >
                            <Eye size={18} />
                          </button>

                          {/* Download DOCX */}
                          <div className={styles.downloadBtnWrap}>
                            <button
                              className={styles.actionBtn}
                              onClick={() => void handleDocxDownload(inv)}
                              disabled={isDocxLoading}
                              title="Download DOCX"
                              style={{ flexDirection: "column", gap: 2, padding: "4px 6px" }}
                            >
                              <FileDown size={13} />
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
                              onClick={() => void handlePdfDownload(inv)}
                              disabled={isPdfLoading}
                              title="Download PDF"
                              style={{ flexDirection: "column", gap: 2, padding: "4px 6px" }}
                            >
                              <FileDown size={13} />
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewArtifact && (
        <InvoicePreviewModal artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
      )}
    </>
  );
}
