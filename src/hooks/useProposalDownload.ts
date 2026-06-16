"use client";

import { useState, useCallback } from "react";
import { getDownloadUrl } from "@/services/proposal";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { MESSAGES } from "@/constants/messages";

interface UseProposalDownloadReturn {
  isDownloading: boolean;
  downloadProposal: (proposalId: number) => Promise<void>;
}

/**
 * Shared hook for downloading a proposal as a DOCX file.
 *
 * Handles:
 * - Fetching the file from the backend download endpoint
 * - Parsing the Content-Disposition header for the filename
 * - Triggering a browser download via a temporary anchor element
 * - Cleanup of the object URL after download starts
 *
 * Used by both the ProposalOutputPage approval bar and the HistoryPage.
 */
export function useProposalDownload(): UseProposalDownloadReturn {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const downloadProposal = useCallback(async (proposalId: number): Promise<void> => {
    setIsDownloading(true);
    try {
      const url = getDownloadUrl(proposalId);
      logger.debug("[useProposalDownload] Downloading from:", url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[useProposalDownload] Download error response:", errorText);
        throw new Error(
          `${MESSAGES.PROPOSAL_DOWNLOAD_FAILED}: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      // Get filename from Content-Disposition header (must be exposed via CORS expose_headers)
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `proposal-${proposalId}.docx`;
      if (contentDisposition) {
        // Prefer RFC 5987 encoded filename* (handles Unicode and spaces)
        const rfc5987Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;\s]+)/i);
        if (rfc5987Match?.[1]) {
          filename = decodeURIComponent(rfc5987Match[1]);
        } else {
          // Fall back to classic quoted or unquoted filename=
          const classicMatch = contentDisposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
          if (classicMatch) {
            filename = classicMatch[1] ?? classicMatch[2] ?? filename;
          }
        }
      }
      logger.debug("[useProposalDownload] Using filename:", filename);

      // Create blob with correct MIME type for Word documents
      const docxBlob = new Blob([blob], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const downloadUrl = window.URL.createObjectURL(docxBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);

      // Trigger download
      a.click();

      // Cleanup after a longer delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      }, 500);

      toast.success(MESSAGES.PROPOSAL_DOWNLOADED);
    } catch (error) {
      logger.error("[useProposalDownload] Download error:", error);
      const message = error instanceof Error ? error.message : MESSAGES.PROPOSAL_DOWNLOAD_FAILED;
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return { isDownloading, downloadProposal };
}
