/**
 * Proposal section CRUD operations
 *
 * Add, remove, reorder, update, and regenerate individual sections.
 */

import { http } from "@/config/httpClient";

interface RegenerateResponse {
  section_key: string;
  content: string;
}

export async function updateSection(
  id: number,
  sectionKey: string,
  content: string
): Promise<void> {
  await http.put<null>(`/proposals/${id}/sections/${sectionKey}/`, { content });
}

export async function regenerateSection(
  id: number,
  sectionKey: string,
  instructions?: string
): Promise<string> {
  const data = await http.post<RegenerateResponse>(`/proposals/${id}/regenerate/`, {
    section_key: sectionKey,
    additional_instructions: instructions ?? null,
  });
  return data.content;
}

export interface RegenerateSelectionResponse {
  section_key: string;
  regenerated_text: string;
  format?: string | null;
}

export interface RegenerateSelectionResult {
  regeneratedText: string;
  format: string | null;
}

export async function regenerateSelection(
  id: number,
  sectionKey: string,
  selectedText: string,
  selectionContext?: string,
  instructions?: string
): Promise<RegenerateSelectionResult> {
  const data = await http.post<RegenerateSelectionResponse>(`/proposals/${id}/regenerate-selection/`, {
    section_key: sectionKey,
    selected_text: selectedText,
    selection_context: selectionContext ?? null,
    instructions: instructions ?? null,
  });
  return {
    regeneratedText: data.regenerated_text,
    format: data.format ?? null,
  };
}

export interface AddSectionPayload {
  key: string;
  label: string;
  instructions?: string;
  templateType?: string;
  formatRules?: string;
}

export interface ReorderSectionsPayload {
  order: string[];
  sectionDisplayNames?: Record<string, string>;
}

export async function addProposalSection(
  id: number,
  payload: AddSectionPayload
): Promise<{ key: string; label: string; content: string; formatType?: string }> {
  return http.post<{ key: string; label: string; content: string; format_type?: string }>(
    `/proposals/${id}/sections/`,
    payload
  ).then(data => ({
    key: data.key,
    label: data.label,
    content: data.content,
    formatType: data.format_type,
  }));
}

export async function removeProposalSection(
  id: number,
  sectionKey: string
): Promise<void> {
  await http.delete<null>(`/proposals/${id}/sections/${sectionKey}/`);
}

export async function reorderProposalSections(
  id: number,
  payload: ReorderSectionsPayload
): Promise<void> {
  await http.patch<null>(`/proposals/${id}/sections/reorder/`, {
    order: payload.order,
    section_display_names: payload.sectionDisplayNames,
  });
}
