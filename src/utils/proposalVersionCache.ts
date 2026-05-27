const CACHE_KEY = "proposal_history_versions_v1";

type VersionCache = Record<number, string>; // proposalId → "v1" | "v2"

function readCache(): VersionCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as VersionCache) : {};
  } catch {
    return {};
  }
}

export function setProposalHistoryVersion(proposalId: number, version: string): void {
  if (typeof window === "undefined") return;
  try {
    const cache = readCache();
    cache[proposalId] = version;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export function getProposalHistoryVersion(proposalId: number): string | null {
  return readCache()[proposalId] ?? null;
}
