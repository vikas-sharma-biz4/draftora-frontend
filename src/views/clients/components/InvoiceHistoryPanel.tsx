"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, FileDown } from "lucide-react";

import { updateArtifact } from "@/services/artifact.service";
import { formatDate } from "@/utils/dateUtils";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { MESSAGES } from "@/constants/messages";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";
import InvoicePreviewModal from "@/components/modals/InvoicePreviewModal/InvoicePreviewModal";
import { useClientInvoicesQuery, clientInvoicesQueryKey } from "@/hooks/useClientInvoicesQuery";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";

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
  const { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf } =
    useArtifactDownload();

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
      toast.success(MESSAGES.INVOICE_STATUS_UPDATED);
    } catch (err) {
      logger.error("[InvoiceHistoryPanel] Status toggle failed:", err);
      toast.error(MESSAGES.INVOICE_STATUS_UPDATE_FAILED);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <div className={styles.invoiceHistory}>
        <div className={styles.panelHeader}>
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

        {isLoading ? (
          <div className={styles.emptyState}>
            <p>Loading invoices…</p>
          </div>
        ) : invoices.length === 0 ? (
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
                  <th className={styles.actionsCol} style={{ width: 130, minWidth: 130 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const meta = inv.metadataJson ?? {};
                  const invoiceNumber = (meta.invoice_number as string | undefined) ?? "—";
                  const jobToBeDone = (meta.job_to_be_done as string | undefined) ?? "—";
                  const totalAmount = (meta.total_amount as number | undefined) ?? 0;
                  const paymentStatus = (meta.payment_status as string | undefined) ?? "Unpaid";

                  return (
                    <tr
                      key={inv.id}
                      className={styles.proposalRow}
                      onClick={() => setPreviewArtifact(inv)}
                      style={{ cursor: "pointer" }}
                    >
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
                        style={{ width: 130, minWidth: 130 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className={styles.invoiceActions}>
                          {/* View */}
                          <button
                            className={styles.actionBtn}
                            onClick={() => setPreviewArtifact(inv)}
                            title="View invoice"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Download DOCX */}
                          <button
                            className={styles.actionBtn}
                            onClick={() => void downloadArtifact(inv.id, inv.title)}
                            disabled={isDownloading}
                            title="Download DOCX"
                            style={{ flexDirection: "column", gap: 2, padding: "4px 8px" }}
                          >
                            <FileDown size={13} />
                            <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                              DOCX
                            </span>
                          </button>

                          {/* Download PDF */}
                          <button
                            className={styles.actionBtn}
                            onClick={() => void downloadArtifactPdf(inv.id, inv.title)}
                            disabled={isPdfDownloading}
                            title="Download PDF"
                            style={{ flexDirection: "column", gap: 2, padding: "4px 8px" }}
                          >
                            <FileDown size={13} />
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

      {previewArtifact && (
        <InvoicePreviewModal artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
      )}
    </>
  );
}
