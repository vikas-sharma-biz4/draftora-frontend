"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, FileDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import { clientInvoicesQueryKey } from "@/hooks/useClientInvoicesQuery";
import { updateArtifact } from "@/services/artifact.service";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { formatDate } from "@/utils/dateUtils";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";

import styles from "./InvoicePreviewModal.module.scss";

const AUTO_SAVE_DEBOUNCE_MS = 300;

// Lazy-load RichEditor — Tiptap is heavy
const RichEditor = dynamic(() => import("@/components/common/RichEditor"), { ssr: false });

type SaveStatus = "idle" | "saving" | "saved";

interface InvoicePreviewModalProps {
  artifact: GeneratedArtifact;
  onClose: () => void;
}

export default function InvoicePreviewModal({
  artifact,
  onClose,
}: InvoicePreviewModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<string>(sanitizeHtml(artifact.content));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf } =
    useArtifactDownload();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      setSaveStatus("saving");

      saveTimerRef.current = setTimeout(() => {
        void updateArtifact(artifact.id, { content: newContent }).then(() => {
          setSaveStatus("saved");
          void queryClient.invalidateQueries({
            queryKey: clientInvoicesQueryKey(artifact.clientId),
          });
        });
      }, AUTO_SAVE_DEBOUNCE_MS);
    },
    [artifact.id, artifact.clientId, queryClient]
  );

  if (!mounted) return null;

  const meta = artifact.metadataJson ?? {};
  const invoiceNumber = (meta.invoice_number as string | undefined) ?? "";
  const invoiceDate = (meta.invoice_date as string | undefined) ?? formatDate(artifact.createdAt);
  const clientName = (meta.client_name as string | undefined) ?? "";
  const totalAmount = (meta.total_amount as number | undefined) ?? 0;
  const paymentStatus = (meta.payment_status as string | undefined) ?? "Unpaid";

  const modalContent = (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
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
              {saveStatus !== "idle" && (
                <span className={styles.saveStatus}>
                  {saveStatus === "saving" ? "Saving…" : "Saved"}
                </span>
              )}
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

        {/* Invoice body — editable rich text */}
        <div className={styles.body}>
          <div className={styles.editorWrapper}>
            <RichEditor
              content={content}
              onChange={handleContentChange}
              placeholder="Invoice content…"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
