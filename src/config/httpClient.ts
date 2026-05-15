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

const _apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

if (!process.env.NEXT_PUBLIC_API_URL) {
  // eslint-disable-next-line no-console
  console.error(
    "[FATAL] NEXT_PUBLIC_API_URL is not set. Every API call will fail. Add it to your .env file."
  );
}

/**
 * Full API base URL including the /api/v1 prefix.
 * Strips any existing /api/v1 suffix from the env var to prevent duplication
 * if NEXT_PUBLIC_API_URL is set to "http://localhost:8000/api/v1" in .env.local.
 * Single source of truth — used by both the HTTP client and SSE connections.
 */
const _baseWithoutSuffix = _apiUrl.replace(/\/api\/v1\/?$/, "");
export const API_BASE_URL = `${_baseWithoutSuffix}/api/v1`;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface FetchConfig {
  headers?: Record<string, string>;
  signal?: AbortSignal;
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
 * Base headers for API requests.
 * Includes ngrok bypass header for development.
 */
function getBaseHeaders(includeContentType: boolean = true): Record<string, string> {
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  // ngrok free tier shows an HTML interstitial page for browser fetch requests.
  // This header bypasses it so API calls get JSON responses instead of HTML.
  if (process.env.NODE_ENV === "development") {
    headers["ngrok-skip-browser-warning"] = "1";
  }

  return headers;
}

/**
 * Auth headers — attaches Bearer token from sessionStorage when available.
 * Safe for SSR: getAccessToken() returns null when window is undefined.
 */
function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
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

/**
 * Handle API response with standard error checking.
 * Validates the response status and success flag, then extracts the data.
 * Throws HttpError (with statusCode) if the request failed.
 */
async function handleResponse<T>(res: Response, method: string): Promise<T> {
  // Handle OPTIONS requests (CORS preflight) - no JSON body expected
  if (method === "OPTIONS" || res.status === 204) {
    return undefined as T;
  }

  // Read response body once to avoid double-read bug
  const rawText = await res.text();

  let json: ApiResponse<T>;

  // Handle empty response bodies
  if (!rawText || rawText.trim() === "") {
    throw new HttpError(res.status, "Response body is empty");
  }

  // Parse JSON safely from raw text (not res.json() since stream was already consumed)
  try {
    json = JSON.parse(rawText);
  } catch (parseError) {
    throw new HttpError(
      res.status,
      `Failed to parse JSON response: ${rawText.substring(0, 200)}`
    );
  }

  if (!res.ok || !json.success) {
    const message: string =
      json?.error?.message ??
      (res.ok ? "API request failed" : `Request failed with status ${res.status}`);
    throw new HttpError(res.status, message);
  }

  return json.data as T;
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  config: FetchConfig = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  // Debug: Log the actual URL being requested
  console.log(`[HTTP] ${method} ${url}`);

  const isFormData = body instanceof FormData;

  const res = await fetch(url, {
    method,
    headers: {
      ...(isFormData ? getBaseHeaders(false) : getBaseHeaders(true)),
      ...getAuthHeaders(),
      ...config.headers,
    },
    body:
      body !== undefined
        ? isFormData
          ? body
          : JSON.stringify(body)
        : undefined,
    signal: config.signal,
    cache: config.cache,
    credentials: config.credentials,
  });

  return handleResponse<T>(res, method);
}

export const http = {
  get: <T>(path: string, config?: FetchConfig): Promise<T> =>
    request<T>("GET", path, undefined, config),

  post: <T>(path: string, body?: unknown, config?: FetchConfig): Promise<T> =>
    request<T>("POST", path, body, config),

  put: <T>(path: string, body?: unknown, config?: FetchConfig): Promise<T> =>
    request<T>("PUT", path, body, config),

  patch: <T>(path: string, body?: unknown, config?: FetchConfig): Promise<T> =>
    request<T>("PATCH", path, body, config),

  delete: <T>(path: string, config?: FetchConfig): Promise<T> =>
    request<T>("DELETE", path, undefined, config),

  /**
   * Download a file as a blob with proper authentication.
   * Returns the raw Response object to allow access to headers like Content-Disposition.
   */
  download: (path: string, config?: FetchConfig): Promise<Response> => {
    const url = `${API_BASE_URL}${path}`;

    const headers: Record<string, string> = {
      ...(config?.headers || {}),
      // Add ngrok bypass header for development
      ...(process.env.NODE_ENV === "development" ? { "ngrok-skip-browser-warning": "1" } : {}),
    };

    // Add authorization header if token exists
    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return fetch(url, {
      method: "GET",
      headers,
      credentials: "include",
      signal: config?.signal,
      cache: config?.cache,
    });
  },
};

/**
 * Build a full URL for a given API path (e.g. for download links).
 */
export function buildUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
