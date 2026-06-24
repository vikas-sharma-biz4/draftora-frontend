"use client";

import { getDownloadUrl, getProposalPdfUrl } from "@/services/proposal";
import { MESSAGES } from "@/constants/messages";
import { useFileDownload } from "@/hooks/useFileDownload";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

interface UseProposalDownloadReturn {
  isDownloading: boolean;
  isPdfDownloading: boolean;
  /** null = idle, -1 = indeterminate, 0-100 = real percent */
  progress: number | null;
  pdfProgress: number | null;
  downloadProposal: (proposalId: number) => Promise<void>;
  downloadProposalPdf: (proposalId: number) => Promise<void>;
}

export function useProposalDownload(): UseProposalDownloadReturn {
  const { isDownloading, progress, download } = useFileDownload({
    buildUrl: getDownloadUrl,
    defaultFilename: (id) => `proposal-${id}.docx`,
    mimeType: DOCX_MIME,
    successMessage: MESSAGES.PROPOSAL_DOWNLOADED,
    failureMessage: MESSAGES.PROPOSAL_DOWNLOAD_FAILED,
  });

  const {
    isDownloading: isPdfDownloading,
    progress: pdfProgress,
    download: downloadPdf,
  } = useFileDownload({
    buildUrl: getProposalPdfUrl,
    defaultFilename: (id) => `proposal-${id}.pdf`,
    mimeType: PDF_MIME,
    successMessage: MESSAGES.PROPOSAL_PDF_DOWNLOADED,
    failureMessage: MESSAGES.PROPOSAL_PDF_DOWNLOAD_FAILED,
  });

  return {
    isDownloading,
    isPdfDownloading,
    progress,
    pdfProgress,
    downloadProposal: download,
    downloadProposalPdf: downloadPdf,
  };
}
