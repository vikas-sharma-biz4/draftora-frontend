import { useEffect } from "react";

// Module-level counter tracks how many components currently hold a scroll lock.
// Using module scope (not component state) ensures the count survives re-renders
// and is shared across all component instances on the same page.
let lockCount = 0;
let savedOverflow = "";

export function useBodyScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow;
      }
    };
  }, [active]);
}
