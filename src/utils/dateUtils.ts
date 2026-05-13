/**
 * Format an ISO date string into a human-readable short date (e.g. "Jan 5, 2025").
 */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Format an ISO date string into a human-readable date with time (e.g. "Jan 5, 2025, 02:30 PM").
 */
export function formatDateWithTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
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
