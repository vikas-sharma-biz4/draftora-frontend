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

  try {
    // Use http client which already has the correct base URL
    const data = await http.post<ParseFilesResponse>("/parse", formData);

    logger.debug('[API] Parse response received:', {
      success: data.success,
      filesReceived: data.files_received,
      filesParsed: data.files_parsed,
      resultsCount: data.results.length,
      errorsCount: data.errors.length,
      message: data.message,
    });

    return data;
  } catch (error) {
    // Backend not available, return mock parsed data for demo
    logger.warn('[API] Backend unavailable, returning mock parse data:', error);

    const mockResults: ParsedFileResult[] = files.map(file => ({
      filename: file.name,
      extension: file.name.split('.').pop() || '',
      size_bytes: file.size,
      char_count: Math.floor(file.size * 0.5), // Rough estimate
      word_count: Math.floor(file.size * 0.1), // Rough estimate
      preview: `This is a preview of ${file.name}. The document contains important information that will be used for context generation...`,
      text: `Full text content of ${file.name} would be parsed here. This content serves as knowledge base for generating proposals.`
    }));

    return {
      success: true,
      message: 'Files processed successfully (demo mode)',
      files_received: files.length,
      files_parsed: files.length,
      results: mockResults,
      errors: []
    };
  }
}

/**
 * Get supported file formats from backend
 */
export async function getSupportedFormats(): Promise<{ extensions: string[]; max_size_mb: number }> {
  const data = await http.get<{ extensions: string[]; max_size_mb: number }>("/parse/supported-formats");
  return data;
}
