"use client";

import { getDownloadUrl } from "@/services/proposal";
import { MESSAGES } from "@/constants/messages";
import { useFileDownload } from "@/hooks/useFileDownload";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface UseProposalDownloadReturn {
  isDownloading: boolean;
  downloadProposal: (proposalId: number) => Promise<void>;
}

export function useProposalDownload(): UseProposalDownloadReturn {
  const { isDownloading, download } = useFileDownload({
    buildUrl: getDownloadUrl,
    defaultFilename: (id) => `proposal-${id}.docx`,
    mimeType: DOCX_MIME,
    successMessage: MESSAGES.PROPOSAL_DOWNLOADED,
    failureMessage: MESSAGES.PROPOSAL_DOWNLOAD_FAILED,
  });

  return { isDownloading, downloadProposal: download };
}
