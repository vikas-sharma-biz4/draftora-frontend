/**
 * HTTP client configuration
 *
 * Provides a configured fetch-based HTTP client with
 * Axios-like ergonomics. All services should use this
 * instead of raw `fetch` + `handleResponse`.
 *
 * Features:
 * - Automatic base URL prefixing
 * - Content-Type / FormData header handling
 * - Bearer token injection from sessionStorage
 * - Standard error extraction from API envelope
 * - Cache, signal, and credentials support
 */

import { getAccessToken } from "@/utils/auth";
import { logger } from "@/utils/logger";

const _apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

if (!process.env.NEXT_PUBLIC_API_URL) {
  logger.error(
    "[FATAL] NEXT_PUBLIC_API_URL is not set. Every API call will fail. Add it to your .env file."
  );
}

/**
 * Full API base URL including the /api/v1 prefix.
 * Single source of truth — used by both the HTTP client and SSE connections.
 */
export const API_BASE_URL = `${_apiUrl}/api/v1`;

const RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 30_000;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface FetchConfig {
  headers?: Record<string, string>;
  /** Caller-supplied abort signal. When provided it overrides the default timeout. */
  signal?: AbortSignal;
  /**
   * Per-request timeout in milliseconds.
   * Ignored when `signal` is provided.
   * Defaults to 30 000 ms (REQUEST_TIMEOUT_MS).
   */
  requestTimeout?: number;
  cache?: RequestCache;
  credentials?: RequestCredentials;
}

/**
 * Standard API response envelope
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Pagination metadata returned by list endpoints.
 * Fields use snake_case to match the raw API contract.
 */
export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/**
 * Shape returned by http.getPaginated — preserves both the data array
 * and the pagination metadata that handleResponse would otherwise discard.
 */
export interface PaginatedApiResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Base headers for API requests.
 * Includes ngrok bypass header for development.
 */
function getBaseHeaders(includeContentType: boolean = true): Record<string, string> {
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  // Bypass tunnel interstitial pages in development so API calls get JSON, not HTML.
  // ngrok shows a warning page; loca.lt (localtunnel) shows a 511 reminder page.
  if (process.env.NODE_ENV === "development") {
    headers["ngrok-skip-browser-warning"] = "1";
    headers["bypass-tunnel-reminder"] = "1";
  }

  return headers;
}

/**
 * Auth headers — attaches Bearer token from sessionStorage when available.
 * Safe for SSR: getAccessToken() returns null when window is undefined.
 */
function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Typed HTTP error carrying the response status code.
 * Enables callers to inspect `error.statusCode` instead of
 * parsing the message string.
 */
export class HttpError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

interface ParsedApiBody {
  success: boolean;
  data?: unknown;
  meta?: PaginationMeta;
  error?: { code: string; message: string; details?: unknown };
}

function parseApiResponse(rawText: string, status: number, ok: boolean): ParsedApiBody {
  if (!rawText || rawText.trim() === "") {
    throw new HttpError(status, "Response body is empty");
  }

  let json: ParsedApiBody | undefined;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new HttpError(status, `Failed to parse JSON response: ${rawText.substring(0, 200)}`);
  }

  if (!json) {
    throw new HttpError(status, "Response body is empty or invalid");
  }

  if (!ok || !json.success) {
    const message: string =
      json?.error?.message ?? (ok ? "API request failed" : `Request failed with status ${status}`);
    throw new HttpError(status, message);
  }

  return json;
}

async function handleResponse<T>(res: Response, method: string): Promise<T> {
  if (method === "OPTIONS" || res.status === 204) {
    return undefined as T;
  }
  const rawText = await res.text();
  const json = parseApiResponse(rawText, res.status, res.ok);
  return json.data as T;
}

async function handlePaginatedResponse<T>(res: Response): Promise<PaginatedApiResponse<T>> {
  if (res.status === 204) {
    return { data: [], meta: { page: 1, per_page: 0, total: 0, total_pages: 0 } };
  }
  const rawText = await res.text();
  const json = parseApiResponse(rawText, res.status, res.ok);
  const data = (json.data as T[] | undefined) ?? [];
  const meta: PaginationMeta = (json.meta as PaginationMeta | undefined) ?? {
    page: 1,
    per_page: data.length,
    total: data.length,
    total_pages: 1,
  };
  return { data, meta };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Deduplicates concurrent GET requests for the same path.
// When two callers request the same URL before the first resolves (e.g. two
// components mounting simultaneously), both receive the same Promise instead
// of two independent network calls. Entry is removed when the promise settles.
const pendingGetRequests = new Map<string, Promise<unknown>>();

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  config: FetchConfig = {},
  attempt = 0,
  responseHandler: (res: Response) => Promise<T> = (res) => handleResponse<T>(res, method)
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const isFormData = body instanceof FormData;
  // Use caller's signal when provided; otherwise apply a default hard timeout so
  // requests never hang indefinitely (e.g. on a slow or unresponsive LLM endpoint).
  const signal = config.signal ?? AbortSignal.timeout(config.requestTimeout ?? REQUEST_TIMEOUT_MS);

  let res: Response;

  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(isFormData ? getBaseHeaders(false) : getBaseHeaders(true)),
        ...getAuthHeaders(),
        ...config.headers,
      },
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal,
      cache: config.cache,
      credentials: config.credentials,
    });
  } catch (err) {
    // Never retry intentionally cancelled or timed-out requests
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw err;
    }
    // Network error — only retry GET requests; non-GET may have already been processed server-side
    if (method === "GET" && attempt < RETRY_ATTEMPTS) {
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      return request<T>(method, path, body, config, attempt + 1, responseHandler);
    }
    throw err;
  }

  // Retry transient server errors for safe (GET) requests only
  if (
    method === "GET" &&
    (res.status === 502 || res.status === 503 || res.status === 504) &&
    attempt < RETRY_ATTEMPTS
  ) {
    await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
    return request<T>(method, path, body, config, attempt + 1, responseHandler);
  }

  return responseHandler(res);
}

/**
 * GET variant for paginated endpoints.
 * Returns { data, meta } so callers can drive multi-page fetches without
 * losing the pagination metadata that handleResponse would otherwise discard.
 * Delegates to request() — same retry/abort/header logic, no duplication.
 */
function requestPaginated<T>(
  path: string,
  config: FetchConfig = {},
  attempt = 0
): Promise<PaginatedApiResponse<T>> {
  return request<PaginatedApiResponse<T>>("GET", path, undefined, config, attempt, (res) =>
    handlePaginatedResponse<T>(res)
  );
}

export const http = {
  get: <T>(path: string, config?: FetchConfig): Promise<T> => {
    // Skip deduplication on the server — module-level state is shared across
    // concurrent SSR requests and would leak one user's data to another.
    // Also skip when the caller supplies its own AbortSignal — they control
    // cancellation independently and must not share a promise.
    if (typeof window === "undefined" || config?.signal) {
      return request<T>("GET", path, undefined, config);
    }

    const existing = pendingGetRequests.get(path) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = request<T>("GET", path, undefined, config).finally(() => {
      pendingGetRequests.delete(path);
    });
    pendingGetRequests.set(path, promise as Promise<unknown>);
    return promise;
  },

  /**
   * GET for paginated endpoints. Returns `{ data, meta }` preserving the
   * pagination metadata alongside the data array. Uses the same deduplication
   * and retry logic as `get`.
   */
  getPaginated: <T>(path: string, config?: FetchConfig): Promise<PaginatedApiResponse<T>> => {
    // Same SSR and caller-signal guards as http.get above.
    if (typeof window === "undefined" || config?.signal) {
      return requestPaginated<T>(path, config);
    }

    const existing = pendingGetRequests.get(path) as Promise<PaginatedApiResponse<T>> | undefined;
    if (existing) return existing;

    const promise = requestPaginated<T>(path, config).finally(() => {
      pendingGetRequests.delete(path);
    });
    pendingGetRequests.set(path, promise as Promise<unknown>);
    return promise;
  },

  post: <T>(path: string, body?: unknown, config?: FetchConfig): Promise<T> =>
    request<T>("POST", path, body, config),

  put: <T>(path: string, body?: unknown, config?: FetchConfig): Promise<T> =>
    request<T>("PUT", path, body, config),

  patch: <T>(path: string, body?: unknown, config?: FetchConfig): Promise<T> =>
    request<T>("PATCH", path, body, config),

  delete: <T>(path: string, config?: FetchConfig): Promise<T> =>
    request<T>("DELETE", path, undefined, config),

  /**
   * GET that returns the raw response body as a Blob.
   * Use for binary endpoints (images, PDFs) where the standard JSON handler
   * would fail. Reuses the same auth headers, retry logic, and timeout.
   */
  getBlob: (path: string, config?: FetchConfig): Promise<Blob> =>
    request<Blob>("GET", path, undefined, config, 0, async (res) => {
      if (!res.ok) {
        throw new HttpError(res.status, `Request failed with status ${res.status}`);
      }
      return res.blob();
    }),
};

/**
 * Build a full URL for a given API path (e.g. for download links).
 */
export function buildUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
