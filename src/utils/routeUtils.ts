/**
 * Route utility functions for pathname-based operations
 */

import type { DraftLocation } from "@/interfaces/draftInterfaces";

/**
 * Maps a pathname to its corresponding DraftLocation
 *
 * This is the single source of truth for route → DraftLocation mapping.
 * All pathname-based location resolution should use this function.
 *
 * Route matching order is deterministic - more specific routes are checked first.
 *
 * @param pathname - The current pathname from Next.js router
 * @returns The corresponding DraftLocation
 */
export function getLastLocationFromPathname(pathname: string): DraftLocation {
  // Exact match for parameters page
  if (pathname === "/parameters") return "wizard_parameters";

  // Exact match for review page
  if (pathname === "/review") return "wizard_review";

  // Prefix match for proposal web view pages
  if (pathname.startsWith("/proposal/")) return "web_view";

  // Prefix match for generating page
  if (pathname.startsWith("/generating")) return "ai_sections";

  // Default fallback
  return "wizard_parameters";
}
