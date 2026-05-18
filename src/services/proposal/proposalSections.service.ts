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

interface RegenerateSelectionResponse {
  section_key: string;
  regenerated_text: string;
}

export async function regenerateSelection(
  id: number,
  sectionKey: string,
  selectedText: string,
  selectionContext?: string,
  instructions?: string
): Promise<string> {
  const data = await http.post<RegenerateSelectionResponse>(`/proposals/${id}/regenerate-selection/`, {
    section_key: sectionKey,
    selected_text: selectedText,
    selection_context: selectionContext ?? null,
    instructions: instructions ?? null,
  });
  return data.regenerated_text;
}

export interface AddSectionPayload {
  key: string;
  label: string;
  instructions?: string;
}

export interface ReorderSectionsPayload {
  order: string[];
  sectionDisplayNames?: Record<string, string>;
}

export async function addProposalSection(
  id: number,
  payload: AddSectionPayload
): Promise<{ key: string; label: string; content: string }> {
  return http.post<{ key: string; label: string; content: string }>(`/proposals/${id}/sections/`, payload);
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
