"use client";

import { useState, useCallback } from "react";
import { getArtifactDownloadUrl, getArtifactPdfUrl } from "@/services/artifact.service";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { MESSAGES } from "@/constants/messages";

interface UseArtifactDownloadReturn {
  isDownloading: boolean;
  downloadArtifact: (artifactId: number, fallbackTitle?: string) => Promise<void>;
  isPdfDownloading: boolean;
  downloadArtifactPdf: (artifactId: number, fallbackTitle?: string) => Promise<void>;
}

/**
 * Hook for downloading a generated artifact as a DOCX file.
 *
 * Reuses the same pattern as useProposalDownload:
 * - Fetches the file from the backend download endpoint
 * - Parses the Content-Disposition header for the filename
 * - Triggers a browser download via a temporary anchor element
 * - Cleans up the object URL after the download starts
 */
export function useArtifactDownload(): UseArtifactDownloadReturn {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isPdfDownloading, setIsPdfDownloading] = useState<boolean>(false);

  const downloadArtifact = useCallback(
    async (artifactId: number, fallbackTitle?: string): Promise<void> => {
      setIsDownloading(true);
      try {
        const url = getArtifactDownloadUrl(artifactId);
        logger.debug("[useArtifactDownload] Downloading from:", url);

        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          logger.error("[useArtifactDownload] Download error response:", errorText);
          throw new Error(
            `${MESSAGES.ARTIFACT_DOWNLOAD_FAILED}: ${response.status} ${response.statusText}`
          );
        }

        const blob = await response.blob();

        if (blob.size === 0) {
          throw new Error("Downloaded file is empty");
        }

        // Prefer RFC 5987 encoded filename*, fall back to classic filename=
        const contentDisposition = response.headers.get("content-disposition");
        let filename = fallbackTitle ? `${fallbackTitle}.docx` : `artifact-${artifactId}.docx`;

        if (contentDisposition) {
          const rfc5987Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;\s]+)/i);
          if (rfc5987Match?.[1]) {
            filename = decodeURIComponent(rfc5987Match[1]);
          } else {
            const classicMatch = contentDisposition.match(
              /filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i
            );
            if (classicMatch) {
              filename = classicMatch[1] ?? classicMatch[2] ?? filename;
            }
          }
        }

        logger.debug("[useArtifactDownload] Using filename:", filename);

        const docxBlob = new Blob([blob], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        const downloadUrl = window.URL.createObjectURL(docxBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
        }, 500);

        toast.success(MESSAGES.ARTIFACT_DOWNLOADED);
      } catch (error) {
        logger.error("[useArtifactDownload] Download error:", error);
        const message = error instanceof Error ? error.message : MESSAGES.ARTIFACT_DOWNLOAD_FAILED;
        toast.error(message);
      } finally {
        setIsDownloading(false);
      }
    },
    []
  );

  const downloadArtifactPdf = useCallback(
    async (artifactId: number, fallbackTitle?: string): Promise<void> => {
      setIsPdfDownloading(true);
      try {
        const url = getArtifactPdfUrl(artifactId);
        logger.debug("[useArtifactDownload] Downloading PDF from:", url);

        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          logger.error("[useArtifactDownload] PDF download error response:", errorText);
          throw new Error(
            `${MESSAGES.ARTIFACT_DOWNLOAD_FAILED}: ${response.status} ${response.statusText}`
          );
        }

        const blob = await response.blob();

        if (blob.size === 0) {
          throw new Error("Downloaded PDF is empty");
        }

        const contentDisposition = response.headers.get("content-disposition");
        let filename = fallbackTitle ? `${fallbackTitle}.pdf` : `artifact-${artifactId}.pdf`;

        if (contentDisposition) {
          const rfc5987Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;\s]+)/i);
          if (rfc5987Match?.[1]) {
            filename = decodeURIComponent(rfc5987Match[1]);
          } else {
            const classicMatch = contentDisposition.match(
              /filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i
            );
            if (classicMatch) {
              filename = classicMatch[1] ?? classicMatch[2] ?? filename;
            }
          }
        }

        const pdfBlob = new Blob([blob], { type: "application/pdf" });
        const downloadUrl = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
        }, 500);

        toast.success(MESSAGES.ARTIFACT_DOWNLOADED);
      } catch (error) {
        logger.error("[useArtifactDownload] PDF download error:", error);
        const message = error instanceof Error ? error.message : MESSAGES.ARTIFACT_DOWNLOAD_FAILED;
        toast.error(message);
      } finally {
        setIsPdfDownloading(false);
      }
    },
    []
  );

  return { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf };
}
