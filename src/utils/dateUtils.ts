/**
 * Format a UTC ISO date string into a short date in the user's local timezone and locale
 * (e.g. "Jan 5, 2025" for en-US, "5 jan. 2025" for fr-FR).
 */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Format a UTC ISO date string into a date with time in the user's local timezone and locale
 * (e.g. "Jan 5, 2025, 02:30 PM" for en-US).
 */
export function formatDateWithTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
