import { logger } from "@/utils/logger";

// API_BASE_URL is now defined and exported from @/config/httpClient.ts
// as the single source of truth. Re-export here for backward compatibility
// with existing imports from @/config/config.
export { API_BASE_URL } from "./httpClient";

// Regenerating architecture diagram sections involves multiple LLM calls,
// the Eraser.io API, and an S3 upload — allow up to 90 s before timing out.
export const REGENERATE_SECTION_TIMEOUT_MS = 90_000;

const _defaultAiModel = process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL;
if (!_defaultAiModel) {
  logger.warn(
    "[config] NEXT_PUBLIC_DEFAULT_AI_MODEL is not set — defaulting to 'gpt-4o'. This may incur higher API costs."
  );
}
export const DEFAULT_AI_MODEL = _defaultAiModel ?? "gpt-4o";

// Debounce delay before batching section edits and persisting the draft.
// Long enough to avoid hammering the API on every keystroke; short enough
// that users don't lose data on unexpected tab closes.
export const SECTION_AUTOSAVE_DEBOUNCE_MS = 1_500;
