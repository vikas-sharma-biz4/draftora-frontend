"use client";

import { getArtifactDownloadUrl, getArtifactPdfUrl } from "@/services/artifact.service";
import { MESSAGES } from "@/constants/messages";
import { useFileDownload } from "@/hooks/useFileDownload";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface UseArtifactDownloadReturn {
  isDownloading: boolean;
  downloadArtifact: (artifactId: number, fallbackTitle?: string) => Promise<void>;
  isPdfDownloading: boolean;
  downloadArtifactPdf: (artifactId: number, fallbackTitle?: string) => Promise<void>;
}

export function useArtifactDownload(): UseArtifactDownloadReturn {
  const { isDownloading, download: downloadArtifact } = useFileDownload({
    buildUrl: getArtifactDownloadUrl,
    defaultFilename: (id, fallbackTitle) =>
      fallbackTitle ? `${fallbackTitle}.docx` : `artifact-${id}.docx`,
    mimeType: DOCX_MIME,
    successMessage: MESSAGES.ARTIFACT_DOWNLOADED,
    failureMessage: MESSAGES.ARTIFACT_DOWNLOAD_FAILED,
  });

  const { isDownloading: isPdfDownloading, download: downloadArtifactPdf } = useFileDownload({
    buildUrl: getArtifactPdfUrl,
    defaultFilename: (id, fallbackTitle) =>
      fallbackTitle ? `${fallbackTitle}.pdf` : `artifact-${id}.pdf`,
    mimeType: "application/pdf",
    successMessage: MESSAGES.ARTIFACT_DOWNLOADED,
    failureMessage: MESSAGES.ARTIFACT_DOWNLOAD_FAILED,
  });

  return { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf };
}
