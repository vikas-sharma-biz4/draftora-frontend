import { HttpError } from "@/config/httpClient";

/**
 * Asserts that `data` is a non-null object with all `requiredFields` present.
 * Throws HttpError(502) on mismatch — missing required fields indicate an
 * upstream contract violation, not a client error.
 *
 * Use at the service layer for high-value endpoints where a silent shape
 * mismatch would produce confusing runtime errors deep in components.
 */
export function assertApiShape<T extends object>(
  data: unknown,
  requiredFields: (keyof T)[],
  context: string
): asserts data is T {
  if (data === null || data === undefined || typeof data !== "object") {
    throw new HttpError(
      502,
      `${context}: expected object, got ${data === null ? "null" : typeof data}`
    );
  }
  const obj = data as Record<string, unknown>;
  const missing = (requiredFields as string[]).filter((f) => !(f in obj));
  if (missing.length > 0) {
    throw new HttpError(502, `${context}: missing required fields: ${missing.join(", ")}`);
  }
}
