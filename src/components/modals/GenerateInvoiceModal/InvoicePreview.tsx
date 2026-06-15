"use client";

import { forwardRef } from "react";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import styles from "./GenerateInvoiceModal.module.scss";

interface InvoicePreviewProps {
  html: string;
}

/**
 * Renders a sanitised HTML invoice preview.
 *
 * The ref is forwarded so the parent can pass it to html2canvas for PDF export.
 * `sanitizeHtml` runs DOMPurify to prevent XSS before rendering.
 */
const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(function InvoicePreview(
  { html },
  ref
) {
  const safeHtml = sanitizeHtml(html);

  return (
    <div
      ref={ref}
      className={styles.previewContent}
      // sanitizeHtml runs DOMPurify — safe to use dangerouslySetInnerHTML
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
});

export default InvoicePreview;
