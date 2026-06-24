"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X, FileDown } from "lucide-react";

import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import { formatDate } from "@/utils/dateUtils";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";

import styles from "./InvoicePreviewModal.module.scss";

interface InvoicePreviewModalProps {
  artifact: GeneratedArtifact;
  onClose: () => void;
}

export default function InvoicePreviewModal({
  artifact,
  onClose,
}: InvoicePreviewModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState(false);

  const { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf } =
    useArtifactDownload();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const meta = artifact.metadataJson ?? {};
  const invoiceNumber = (meta.invoice_number as string | undefined) ?? "";
  const invoiceDate = (meta.invoice_date as string | undefined) ?? formatDate(artifact.createdAt);
  const clientName = (meta.client_name as string | undefined) ?? "";
  const totalAmount = (meta.total_amount as number | undefined) ?? 0;
  const paymentStatus = (meta.payment_status as string | undefined) ?? "Unpaid";

  // Use the stored S3 PDF (if available) for an inline preview instead of
  // re-rendering the HTML. The PDF was stored to S3 by the backend on first
  // download. We serve it via the download endpoint with ?inline=true so the
  // browser renders it directly in an iframe.
  const s3Block = (artifact.metadataJson?.s3 ?? {}) as Record<string, unknown>;
  const hasPdfKey = Boolean(s3Block.pdf_key);
  const pdfPreviewUrl = hasPdfKey
    ? `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/v1/artifacts/${artifact.id}/download?format=pdf&inline=true`
    : null;

  // Strip legacy duplicate total-row injected by old template versions
  const strippedContent = artifact.content.replace(
    /<tr[^>]*\bclass="total-row"[^>]*>[\s\S]*?<\/tr>/g,
    ""
  );
  const safeHtml = sanitizeHtml(strippedContent);

  const content = (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.invoiceId}>
              {invoiceNumber ? `Invoice #${invoiceNumber}` : "Invoice Preview"}
            </div>
            <div className={styles.invoiceMeta}>
              {clientName && <span>{clientName}</span>}
              {invoiceDate && <span>{invoiceDate}</span>}
              {totalAmount > 0 && (
                <span className={styles.amount}>
                  ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                </span>
              )}
              <span
                className={`${styles.statusBadge} ${
                  paymentStatus === "Paid" ? styles.statusPaid : styles.statusUnpaid
                }`}
              >
                {paymentStatus}
              </span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void downloadArtifact(artifact.id, artifact.title)}
              disabled={isDownloading}
            >
              <FileDown size={14} />
              {isDownloading ? "…" : "DOCX"}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void downloadArtifactPdf(artifact.id, artifact.title)}
              disabled={isPdfDownloading}
            >
              <FileDown size={14} />
              {isPdfDownloading ? "…" : "PDF"}
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice body — PDF iframe when available, HTML fallback otherwise */}
        <div className={styles.body}>
          {pdfPreviewUrl ? (
            <iframe src={pdfPreviewUrl} className={styles.pdfIframe} title="Invoice PDF Preview" />
          ) : (
            <div className={styles.htmlContent} dangerouslySetInnerHTML={{ __html: safeHtml }} />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
