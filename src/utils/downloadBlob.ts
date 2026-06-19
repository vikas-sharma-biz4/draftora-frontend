// 500 ms lets the browser process the anchor click before cleanup;
// shorter delays cause Chrome to cancel the download in flight.
const DOWNLOAD_CLEANUP_DELAY_MS = 500;

export function downloadBlob(content: BlobPart, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {
      // Element may already have been removed — safe to ignore
    }
    URL.revokeObjectURL(url);
  }, DOWNLOAD_CLEANUP_DELAY_MS);
}

/**
 * Parses the Content-Disposition header to extract a filename.
 * Prefers the RFC 5987 `filename*=UTF-8''...` form (handles Unicode/spaces),
 * falls back to the classic `filename="..."` form, and returns `fallback` if
 * neither is present.
 */
export function extractContentDispositionFilename(
  contentDisposition: string | null,
  fallback: string
): string {
  if (!contentDisposition) return fallback;

  const rfc5987Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;\s]+)/i);
  if (rfc5987Match?.[1]) {
    return decodeURIComponent(rfc5987Match[1]);
  }

  const classicMatch = contentDisposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
  if (classicMatch) {
    return classicMatch[1] ?? classicMatch[2] ?? fallback;
  }

  return fallback;
}
