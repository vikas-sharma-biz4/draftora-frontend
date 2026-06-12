import { useState, useEffect } from "react";

/**
 * Returns true when the given CSS media query matches.
 * SSR-safe — returns false on the server.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    /* istanbul ignore next */
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    /* istanbul ignore next */
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent): void => setMatches(e.matches);

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handler);
    return (): void => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export const useIsMobile = (): boolean => useMediaQuery("(max-width: 640px)");
export const useIsTablet = (): boolean => useMediaQuery("(max-width: 1024px)");
export const useIsDesktop = (): boolean => useMediaQuery("(min-width: 1280px)");
