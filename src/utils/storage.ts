/**
 * Typed localStorage / sessionStorage wrapper
 *
 * SSR-safe — all methods check for window availability before accessing the
 * Web Storage API, making them safe to call during Next.js server rendering.
 */

type StorageType = "local" | "session";

function getStorage(type: StorageType): Storage | null {
  if (typeof window === "undefined") return null;
  return type === "local" ? window.localStorage : window.sessionStorage;
}

export const storage = {
  get<T>(key: string, fallback?: T, type: StorageType = "local"): T | undefined {
    try {
      const raw = getStorage(type)?.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T, type: StorageType = "local"): void {
    try {
      getStorage(type)?.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or private browsing — silently fail
    }
  },

  remove(key: string, type: StorageType = "local"): void {
    getStorage(type)?.removeItem(key);
  },

  clear(type: StorageType = "local"): void {
    getStorage(type)?.clear();
  },

  has(key: string, type: StorageType = "local"): boolean {
    return getStorage(type)?.getItem(key) !== null;
  },
};
