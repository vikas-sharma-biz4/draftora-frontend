import { useEffect, useRef } from "react";

/**
 * Calls `onVisible` whenever the browser tab becomes active again
 * (i.e. the `visibilitychange` event fires with `document.hidden === false`).
 *
 * Uses a ref to always invoke the latest version of the callback without
 * requiring callers to memoize it. The event listener is registered once
 * on mount and torn down on unmount.
 */
export function usePageVisibility(onVisible: () => void): void {
  const callbackRef = useRef(onVisible);
  callbackRef.current = onVisible;

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = (): void => {
      if (!document.hidden) callbackRef.current();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
