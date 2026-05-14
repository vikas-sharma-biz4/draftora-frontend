"use client";

import { useState, useCallback } from "react";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { MESSAGES } from "@/constants/messages";
import { http } from "@/config/httpClient";

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
      const path = `/proposals/${proposalId}/download`;
      logger.debug("[useProposalDownload] Downloading from path:", path);

      const response = await http.download(path);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[useProposalDownload] Download error response:", errorText);
        throw new Error(`${MESSAGES.PROPOSAL_DOWNLOAD_FAILED}: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      // Get filename from Content-Disposition header if available
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `proposal-${proposalId}.docx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "");
        }
      }
      logger.debug("[useProposalDownload] Using filename:", filename);

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);

      // Trigger download
      a.click();

      // Wait a moment before cleanup to ensure download starts
      // Use requestIdleCallback when available for more reliable cleanup;
      // fall back to setTimeout on older browsers.
      const scheduleCleanup = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1000));
      scheduleCleanup(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      });

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
