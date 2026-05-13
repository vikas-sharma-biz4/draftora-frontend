import { RefObject, useEffect } from "react";

/**
 * Calls the handler whenever a click or touch occurs outside the referenced element.
 * Pass `active = false` to temporarily disable the listener.
 */
export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void,
  active = true
): void {
  useEffect(() => {
    if (!active) return;

    function listener(event: MouseEvent | TouchEvent): void {
      const el = ref?.current;
      if (!el || el.contains(event.target as Node)) return;
      handler(event);
    }

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return (): void => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler, active]);
}
