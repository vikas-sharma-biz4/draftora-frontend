"use client";

import { useCallback, useRef, useState } from "react";

import { downloadBlob, extractContentDispositionFilename } from "@/utils/downloadBlob";
import { logger } from "@/utils/logger";
import { toast } from "@/utils/toast";

interface FileDownloadConfig {
  buildUrl: (id: number) => string;
  defaultFilename: (id: number, fallbackTitle?: string) => string;
  mimeType: string;
  successMessage: string;
  failureMessage: string;
}

interface UseFileDownloadReturn {
  isDownloading: boolean;
  download: (id: number, fallbackTitle?: string) => Promise<void>;
}

/**
 * Base hook for file downloads via a backend URL.
 *
 * Handles fetch, empty-blob guard, RFC 5987 Content-Disposition parsing,
 * blob triggering, and error toasting. Pass a config object describing the
 * URL builder, default filename, MIME type, and toast messages.
 *
 * Config is read via a ref so the `download` callback is always stable,
 * regardless of whether the caller recreates the config object on each render.
 */
export function useFileDownload(config: FileDownloadConfig): UseFileDownloadReturn {
  const configRef = useRef<FileDownloadConfig>(config);
  configRef.current = config;

  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const download = useCallback(async (id: number, fallbackTitle?: string): Promise<void> => {
    const { buildUrl, defaultFilename, mimeType, successMessage, failureMessage } =
      configRef.current;

    setIsDownloading(true);
    try {
      const url = buildUrl(id);
      logger.debug("[useFileDownload] Downloading from:", url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[useFileDownload] Download error response:", errorText);
        throw new Error(`${failureMessage}: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      const filename = extractContentDispositionFilename(
        response.headers.get("content-disposition"),
        defaultFilename(id, fallbackTitle)
      );

      logger.debug("[useFileDownload] Using filename:", filename);

      downloadBlob(blob, filename, mimeType);
      toast.success(successMessage);
    } catch (error) {
      logger.error("[useFileDownload] Download error:", error);
      toast.error(error instanceof Error ? error.message : configRef.current.failureMessage);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return { isDownloading, download };
}
