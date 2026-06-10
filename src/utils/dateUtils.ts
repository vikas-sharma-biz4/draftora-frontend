function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Format a UTC ISO date string into a short date in the user's local timezone and locale
 * (e.g. "Jan 5th, 2025" for en-US).
 */
export function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const day = date.getDate();
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
  } catch {
    return "";
  }
}

/**
 * Format a UTC ISO date string into a date with time, always in en-US locale
 * (e.g. "January 5th, 2025, 02:30 PM").
 */
export function formatDateWithTime(iso: string): string {
  try {
    const date = new Date(iso);
    const day = date.getDate();
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const year = date.getFullYear();
    const time = date.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `${month} ${day}${getOrdinalSuffix(day)}, ${year}, ${time}`;
  } catch {
    return "";
  }
}
