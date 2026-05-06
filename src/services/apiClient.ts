/**
 * Shared API client utilities
 * 
 * Provides common functionality for API calls including response handling,
 * error processing, and request configuration.
 */

import { logger } from "@/utils/logger";

/**
 * Standard API response envelope
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Handle API response with standard error checking
 * 
 * Validates the response status and success flag, then extracts the data.
 * Throws an error with a descriptive message if the request failed.
 * 
 * @param res - Fetch Response object
 * @returns Parsed data from the response
 * @throws Error if response is not ok or success flag is false
 */
export async function handleResponse<T>(res: Response): Promise<T> {
  const json: ApiResponse<T> = await res.json();
  
  if (!res.ok || !json.success) {
    const message: string =
      json?.error?.message ?? `Request failed with status ${res.status}`;
    logger.error('[API] Request failed:', { status: res.status, message, error: json.error });
    throw new Error(message);
  }
  
  return json.data as T;
}

/**
 * Base headers for API requests
 * Includes ngrok bypass header for development
 */
export function getBaseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // ngrok free tier shows an HTML interstitial page for browser fetch requests.
  // This header bypasses it so API calls get JSON responses instead of HTML.
  if (process.env.NODE_ENV === 'development') {
    headers['ngrok-skip-browser-warning'] = '1';
  }
  
  return headers;
}

/**
 * Get headers without Content-Type (for FormData requests)
 */
export function getBaseHeadersWithoutContentType(): Record<string, string> {
  const headers = getBaseHeaders();
  delete headers['Content-Type'];
  return headers;
}
