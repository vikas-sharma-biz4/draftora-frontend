/**
 * http — project-wide HTTP client
 *
 * Re-exports the configured fetch-based client from src/config/httpClient.ts.
 * Import from here for a shorter path: `import { http } from '@/utils/http'`.
 */

export { http, buildUrl, HttpError } from "@/config/httpClient";
