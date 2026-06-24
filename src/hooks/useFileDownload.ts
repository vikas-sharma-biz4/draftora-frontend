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
  /**
   * null  = idle (not downloading)
   * -1    = downloading but Content-Length unavailable (indeterminate)
   * 0–100 = real download percentage
   */
  progress: number | null;
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
 *
 * Progress is tracked via ReadableStream when the server sends Content-Length.
 * Falls back to indeterminate (-1) when Content-Length is absent.
 */
export function useFileDownload(config: FileDownloadConfig): UseFileDownloadReturn {
  const configRef = useRef<FileDownloadConfig>(config);
  configRef.current = config;

  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number | null>(null);

  const download = useCallback(async (id: number, fallbackTitle?: string): Promise<void> => {
    const { buildUrl, defaultFilename, mimeType, successMessage, failureMessage } =
      configRef.current;

    setIsDownloading(true);
    setProgress(null);
    try {
      const url = buildUrl(id);
      logger.debug("[useFileDownload] Downloading from:", url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[useFileDownload] Download error response:", errorText);
        throw new Error(`${failureMessage}: ${response.status} ${response.statusText}`);
      }

      const contentLength = Number(response.headers.get("Content-Length")) || 0;
      const chunks: Uint8Array[] = [];
      let received = 0;

      // Start indeterminate or at 0 depending on whether we know the total size
      setProgress(contentLength > 0 ? 0 : -1);

      if (response.body) {
        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (contentLength > 0) {
              // Cap at 99 so 100 is only set after the blob is ready
              setProgress(Math.min(Math.round((received / contentLength) * 100), 99));
            }
          }
        }
      }

      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      const filename = extractContentDispositionFilename(
        response.headers.get("content-disposition"),
        defaultFilename(id, fallbackTitle)
      );

      logger.debug("[useFileDownload] Using filename:", filename);

      setProgress(100);
      downloadBlob(blob, filename, mimeType);
      toast.success(successMessage);
    } catch (error) {
      logger.error("[useFileDownload] Download error:", error);
      toast.error(error instanceof Error ? error.message : configRef.current.failureMessage);
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  }, []);

  return { isDownloading, progress, download };
}
