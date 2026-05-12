import { logger } from "@/utils/logger";

// API_BASE_URL is now defined and exported from @/config/httpClient.ts
// as the single source of truth. Re-export here for backward compatibility
// with existing imports from @/config/config.
export { API_BASE_URL } from "./httpClient";

export const POLLING_INTERVAL_MS = 3000;
export const MAX_POLL_ATTEMPTS = 120;

const _defaultAiModel = process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL;
if (!_defaultAiModel) {
  logger.warn("[config] NEXT_PUBLIC_DEFAULT_AI_MODEL is not set — defaulting to 'gpt-4o'. This may incur higher API costs.");
}
export const DEFAULT_AI_MODEL = _defaultAiModel ?? "gpt-4o";

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
