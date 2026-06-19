/**
 * Client-side PDF export utility using html2canvas + jsPDF.
 *
 * Lazily imports both packages so they are NOT included in the initial
 * bundle — they only load when the user explicitly clicks "Export PDF".
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   <div ref={ref}>…invoice or email content…</div>
 *   await exportElementAsPdf(ref.current, "invoice-title");
 */

import { logger } from "@/utils/logger";

/**
 * Capture a DOM element as a PDF and trigger a browser download.
 *
 * @param element - The DOM element to capture (must be in the DOM and visible).
 * @param filename - Base filename without extension (e.g. "Invoice_ClientName").
 */
export async function exportElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    // Scale 2x for crisp text rendering
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      // Capture the full scrollable height, not just the visible viewport
      height: element.scrollHeight,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidthPx = canvas.width;
    const imgHeightPx = canvas.height;

    // Scale the image to fit the PDF page width
    const ratio = pdfWidth / imgWidthPx;
    const scaledHeight = imgHeightPx * ratio;

    let yOffset = 0;
    let remainingHeight = scaledHeight;

    // Add multiple pages if the content is taller than one A4 page
    while (remainingHeight > 0) {
      pdf.addImage(imgData, "PNG", 0, -yOffset, pdfWidth, scaledHeight);

      remainingHeight -= pdfHeight;
      if (remainingHeight > 0) {
        pdf.addPage();
        yOffset += pdfHeight;
      }
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9_\- ]/g, "_").trim() || "artifact";
    pdf.save(`${safeFilename}.pdf`);

    logger.debug("[exportPdf] PDF exported | filename=%s", safeFilename);
  } catch (error) {
    logger.error("[exportPdf] PDF export failed:", error);
    throw error;
  }
}
