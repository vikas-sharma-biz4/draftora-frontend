/**
 * Template and document parsing services
 *
 * Custom template parsing, recreate document parsing,
 * file parsing (Docling + OCR), and section suggestions.
 */

import { http } from "@/config/httpClient";

// ── Template Parsing ───────────────────────────────────────────────────────────

export interface ExtractedTemplateSection {
  key: string;
  label: string;
  description: string;
}

export interface ParseTemplateResult {
  sections: ExtractedTemplateSection[];
  sourceType: string;
  totalSections: number;
}

export async function parseCustomTemplate(
  file: File
): Promise<ParseTemplateResult> {
  const formData = new FormData();
  formData.append("file", file);

  const data = await http.post<{
    sections: Array<{ key: string; label: string; description: string }>;
    source_type: string;
    total_sections: number;
  }>("/templates/parse", formData);
  return {
    sections: data.sections,
    sourceType: data.source_type,
    totalSections: data.total_sections,
  };
}

// ── Recreate template document parsing ──────────────────────────────────────

export interface RecreateExtractedSection {
  id: string;
  title: string;
  content: string;
  order: number;
  type: string;
  level?: number;
  parentId?: string;
}

export interface ParseRecreateResult {
  sections: RecreateExtractedSection[];
  sourceType: string;
  totalSections: number;
  fullText: string;
}

/**
 * Parse a document fully for recreate mode, returning sections with their content.
 */
export async function parseRecreateDocument(
  file: File,
  signal?: AbortSignal
): Promise<ParseRecreateResult> {
  const formData = new FormData();
  formData.append("file", file);

  const d = await http.post<{
    sections: Array<{
      id: string;
      title: string;
      content: string;
      order: number;
      type: string;
    }>;
    source_type: string;
    total_sections: number;
    full_text: string;
  }>("/templates/parse-recreate", formData, { signal });

  return {
    sections: d.sections,
    sourceType: d.source_type,
    totalSections: d.total_sections,
    fullText: d.full_text,
  };
}

// ── File Parsing ─────────────────────────────────────────────────────────────

export interface ParsedFileResult {
  filename: string;
  extension: string;
  sizeBytes: number;
  charCount: number;
  wordCount: number;
  preview: string;
  text: string;
}

export interface ParseFilesResponse {
  success: boolean;
  message: string;
  filesReceived: number;
  filesParsed: number;
  results: ParsedFileResult[];
  errors: Array<{ filename: string; error: string }>;
}

/**
 * Typed raw response from the backend parse endpoint (snake_case fields inside data envelope).
 */
interface RawParsedFileResult {
  filename:  string;
  extension: string;
  size_bytes: number;
  char_count: number;
  word_count: number;
  preview:   string;
  text:      string;
}

interface RawParseFilesData {
  message:        string;
  files_received: number;
  files_parsed:   number;
  results:        RawParsedFileResult[];
  errors:         Array<{ filename: string; error: string }>;
}

/**
 * Upload one or more files to the backend parsing engine (Docling + OCR).
 * Returns extracted text content per file.
 */
export async function parseFiles(files: File[]): Promise<ParseFilesResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const data = await http.post<RawParseFilesData>("/parse", formData);

  return {
    success: true,
    message: data.message,
    filesReceived: data.files_received,
    filesParsed: data.files_parsed,
    results: data.results.map((r) => ({
      filename:  r.filename,
      extension: r.extension,
      sizeBytes: r.size_bytes,
      charCount: r.char_count,
      wordCount: r.word_count,
      preview:   r.preview,
      text:      r.text,
    })),
    errors: data.errors ?? [],
  };
}

/**
 * Fetch the list of file extensions supported by the backend parser.
 */
export async function getSupportedParseFormats(): Promise<string[]> {
  const data = await http.get<{ extensions: string[] }>("/parse/supported-formats", { cache: "no-store" });
  return data.extensions ?? [];
}

// ── Section Suggestion ─────────────────────────────────────────────────────────

export interface SuggestSectionsPayload {
  title: string;
  description: string;
  templateType: string;
  context?: string;
}

export interface SuggestedSection {
  key: string;
  label: string;
  description: string;
}

export async function suggestSections(
  payload: SuggestSectionsPayload
): Promise<SuggestedSection[]> {
  const data = await http.post<{ sections: SuggestedSection[] }>("/proposals/suggest-sections", {
    title: payload.title,
    description: payload.description,
    template_type: payload.templateType,
    context: payload.context,
  });
  return data.sections;
}

// ── AI Section Recommendations ──────────────────────────────────────────────

export interface SectionRecommendation {
  sectionTitle: string;
  description: string;
  reasoning: string;
  relevanceScore: number;
  include: string;
  exclude: string;
  purpose: string;
}

export interface ExistingSectionWithRules {
  sectionKey: string;
  sectionName: string;
  include?: string;
  exclude?: string;
  purpose?: string;
}

export interface RecommendSectionsRequest {
  templateId?: string | null;
  existingSections: string[];
  existingSectionsWithRules: ExistingSectionWithRules[];
  context: string;
  userPrompt?: string | null;
}

/**
 * Get AI-powered section recommendations based on context
 */
export async function getSectionRecommendations(
  request: RecommendSectionsRequest
): Promise<SectionRecommendation[]> {
  const response = await http.post<{
    recommendations: Array<{
      section_title: string;
      description: string;
      reasoning: string;
      relevance_score: number;
      include: string;
      exclude: string;
      purpose: string;
    }>;
  }>("/proposals/recommend-sections", {
    template_id: request.templateId,
    existing_sections: request.existingSections,
    existing_sections_with_rules: request.existingSectionsWithRules.map(s => ({
      section_key: s.sectionKey,
      section_name: s.sectionName,
      include: s.include,
      exclude: s.exclude,
      purpose: s.purpose,
    })),
    context: request.context,
    user_prompt: request.userPrompt,
  });
  return response.recommendations.map(r => ({
    sectionTitle: r.section_title,
    description: r.description,
    reasoning: r.reasoning,
    relevanceScore: r.relevance_score,
    include: r.include,
    exclude: r.exclude,
    purpose: r.purpose,
  }));
}
