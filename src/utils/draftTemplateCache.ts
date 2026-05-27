const CACHE_KEY = "draft_template_meta_v1";

interface DraftTemplateMeta {
  templateId: string | null;
  templateType: string;
}

type DraftTemplateCache = Record<string, DraftTemplateMeta>;

function readCache(): DraftTemplateCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DraftTemplateCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: DraftTemplateCache): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export function getDraftTemplateMeta(draftId: string): DraftTemplateMeta | null {
  return readCache()[draftId] ?? null;
}

export function setDraftTemplateMeta(draftId: string, meta: DraftTemplateMeta): void {
  const cache = readCache();
  cache[draftId] = meta;
  writeCache(cache);
}

export function removeDraftTemplateMeta(draftId: string): void {
  const cache = readCache();
  delete cache[draftId];
  writeCache(cache);
}
