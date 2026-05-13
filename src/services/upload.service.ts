/**
 * API service for backend communication
 */

import { http } from "@/config/httpClient";
import { logger } from "@/utils/logger";

export interface ParsedFileResult {
  filename: string;
  extension: string;
  size_bytes: number;
  char_count: number;
  word_count: number;
  preview: string;
  text: string;
}

export interface ParseFilesResponse {
  success: boolean;
  message: string;
  files_received: number;
  files_parsed: number;
  results: ParsedFileResult[];
  errors: Array<{ filename: string; error: string }>;
}

/**
 * Parse uploaded files using the backend API
 */
export async function parseFiles(files: File[]): Promise<ParseFilesResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  logger.debug(`[API] Sending ${files.length} file(s) to backend for parsing...`);

  // Parse endpoint returns data directly, not wrapped in ApiResponse envelope
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/parse/`, {
    method: 'POST',
    headers: {
      'ngrok-skip-browser-warning': '1',
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Parse request failed with status ${response.status}`);
  }

  const data: ParseFilesResponse = await response.json();

  logger.debug('[API] Parse response received:', {
    success: data.success,
    filesReceived: data.files_received,
    filesParsed: data.files_parsed,
    resultsCount: data.results.length,
    errorsCount: data.errors.length,
    message: data.message,
  });

  return data;
}

/**
 * Get supported file formats from backend
 */
export async function getSupportedFormats(): Promise<{ extensions: string[]; max_size_mb: number }> {
  const data = await http.get<{ extensions: string[]; max_size_mb: number }>("/parse/supported-formats/");
  return data;
}
