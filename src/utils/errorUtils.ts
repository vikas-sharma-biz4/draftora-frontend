import { HttpError } from "@/config/httpClient";

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof HttpError ? error.message : fallback;
}
