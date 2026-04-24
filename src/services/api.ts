/**
 * API service for backend communication
 */

import { API_BASE_URL } from "../config/config";

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

  console.log(`[API] Sending ${files.length} file(s) to backend for parsing...`);
  console.log('[API] Endpoint:', `${API_BASE_URL}/parse/`);
  console.log('[API] Files:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));

  try {
    console.log('[API] Making request to:', `${API_BASE_URL}/parse/`);

    const response = await fetch(`${API_BASE_URL}/parse/`, {
      method: 'POST',
      body: formData,
      mode: 'cors',
    });

    console.log('[API] Response status:', response.status);
    console.log('[API] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API ERROR] HTTP ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data: ParseFilesResponse = await response.json();
    console.log('[API] Parse response received:', {
      success: data.success,
      filesReceived: data.files_received,
      filesParsed: data.files_parsed,
      resultsCount: data.results.length,
      errorsCount: data.errors.length,
      message: data.message
    });

    return data;
  } catch (error) {
    console.error('[API ERROR] Failed to parse files:', error);
    console.error('[API ERROR] Error type:', error instanceof TypeError ? 'Network/CORS error' : 'Other error');
    console.error('[API ERROR] API_BASE_URL:', API_BASE_URL);
    throw error;
  }
}

/**
 * Get supported file formats from backend
 */
export async function getSupportedFormats(): Promise<{ extensions: string[]; max_size_mb: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/parse/supported-formats/`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('[API ERROR] Failed to get supported formats:', error);
    throw error;
  }
}
