import { useState, useEffect } from "react";

/**
 * Delays updating a value until after the specified delay has elapsed
 * since the last change. Useful for search inputs and live filters.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return (): void => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
