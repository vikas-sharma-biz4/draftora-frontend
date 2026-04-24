const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is required");
}
export const API_BASE_URL = `${apiUrl}/api/v1`;

export const POLLING_INTERVAL_MS = 3000;
export const MAX_POLL_ATTEMPTS = 120;

export const DEFAULT_AI_MODEL =
  process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL ?? "gpt-4o";

// File-parsing time estimate constants (ms)
export const PARSING_BASE_TIME_MS: Record<string, number> = {
  pdf: 3000,
  docx: 2000,
  xlsx: 2500,
  pptx: 2200,
};
export const PARSING_DEFAULT_BASE_TIME_MS = 2500;

export const PARSING_SIZE_MULTIPLIERS: [number, number][] = [
  [0.5, 0.5],
  [2, 1],
  [5, 1.5],
];
export const PARSING_LARGE_SIZE_MULTIPLIER = 2;
export const PARSING_VARIANCE = 0.2;
