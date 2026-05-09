import { API_BASE_URL } from "@/config/config";
import type { SavedDraft, SaveDraftPayload, DraftMetadata } from "@/interfaces/draftInterfaces";

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

if (process.env.NODE_ENV === "development") {
  BASE_HEADERS["ngrok-skip-browser-warning"] = "1";
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    const message: string =
      json?.error?.message ?? `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  // Handle both wrapped response format { success: true, data: ... } and direct data
  if (json.success !== undefined) {
    if (!json.success) {
      const message: string = json?.error?.message ?? "Request failed";
      throw new Error(message);
    }
    return json.data as T;
  }
  // Return data directly if not wrapped
  return json as T;
}

export async function saveDraft(payload: SaveDraftPayload): Promise<SavedDraft> {
  const res = await fetch(`${API_BASE_URL}/drafts/`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: JSON.stringify({
      proposal_id: payload.proposalId,
      title: payload.title,
      client_name: payload.clientName,
      status: payload.status,
      last_location: payload.lastLocation,
      stage: payload.stage,
      wizard_state: payload.wizardState,
      generated_content: payload.generatedContent,
      ui_state: payload.uiState,
    }),
  });

  const data = await handleResponse<{
    id: string;
    proposal_id: number | null;
    title: string;
    client_name: string;
    status: string;
    last_location: string;
    stage: string;
    wizard_state: Record<string, unknown>;
    generated_content: Record<string, string>;
    ui_state: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    version: number;
  }>(res);

  return {
    id: data.id,
    proposalId: data.proposal_id,
    title: data.title,
    clientName: data.client_name,
    status: data.status as "draft" | "generating" | "completed",
    lastLocation: data.last_location as SavedDraft["lastLocation"],
    stage: data.stage as SavedDraft["stage"],
    wizardState: data.wizard_state as unknown as SavedDraft["wizardState"],
    generatedContent: data.generated_content,
    uiState: data.ui_state as unknown as SavedDraft["uiState"],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    version: data.version,
  };
}

export async function updateDraft(
  draftId: string,
  payload: Partial<SaveDraftPayload>
): Promise<SavedDraft> {
  const res = await fetch(`${API_BASE_URL}/drafts/${draftId}/`, {
    method: "PUT",
    headers: BASE_HEADERS,
    body: JSON.stringify({
      proposal_id: payload.proposalId,
      title: payload.title,
      client_name: payload.clientName,
      status: payload.status,
      last_location: payload.lastLocation,
      stage: payload.stage,
      wizard_state: payload.wizardState,
      generated_content: payload.generatedContent,
      ui_state: payload.uiState,
    }),
  });

  const data = await handleResponse<{
    id: string;
    proposal_id: number | null;
    title: string;
    client_name: string;
    status: string;
    last_location: string;
    stage: string;
    wizard_state: Record<string, unknown>;
    generated_content: Record<string, string>;
    ui_state: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    version: number;
  }>(res);

  return {
    id: data.id,
    proposalId: data.proposal_id,
    title: data.title,
    clientName: data.client_name,
    status: data.status as "draft" | "generating" | "completed",
    lastLocation: data.last_location as SavedDraft["lastLocation"],
    stage: data.stage as SavedDraft["stage"],
    wizardState: data.wizard_state as unknown as SavedDraft["wizardState"],
    generatedContent: data.generated_content,
    uiState: data.ui_state as unknown as SavedDraft["uiState"],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    version: data.version,
  };
}

export async function getDraft(draftId: string): Promise<SavedDraft> {
  const res = await fetch(`${API_BASE_URL}/drafts/${draftId}/`, {
    cache: "no-store",
    headers: BASE_HEADERS,
  });

  const data = await handleResponse<{
    id: string;
    proposal_id: number | null;
    title: string;
    client_name: string;
    status: string;
    last_location: string;
    stage: string;
    wizard_state: Record<string, unknown>;
    generated_content: Record<string, string>;
    ui_state: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    version: number;
  }>(res);

  return {
    id: data.id,
    proposalId: data.proposal_id,
    title: data.title,
    clientName: data.client_name,
    status: data.status as "draft" | "generating" | "completed",
    lastLocation: data.last_location as SavedDraft["lastLocation"],
    stage: data.stage as SavedDraft["stage"],
    wizardState: data.wizard_state as unknown as SavedDraft["wizardState"],
    generatedContent: data.generated_content,
    uiState: data.ui_state as unknown as SavedDraft["uiState"],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    version: data.version,
  };
}

export async function listDrafts(): Promise<DraftMetadata[]> {
  const res = await fetch(`${API_BASE_URL}/drafts/`, {
    cache: "no-store",
    headers: BASE_HEADERS,
  });

  const data = await handleResponse<
    {
      id: string;
      proposal_id: number | null;
      title: string;
      client_name: string;
      status: string;
      last_location: string;
      stage: string;
      updated_at: string;
    }[]
  >(res);

  return data.map((d) => ({
    id: d.id,
    proposalId: d.proposal_id,
    title: d.title,
    clientName: d.client_name,
    status: d.status as DraftMetadata["status"],
    lastLocation: d.last_location as DraftMetadata["lastLocation"],
    stage: d.stage as DraftMetadata["stage"],
    updatedAt: d.updated_at,
  }));
}

export async function deleteDraft(draftId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/drafts/${draftId}/`, {
    method: "DELETE",
    headers: BASE_HEADERS,
  });

  await handleResponse<null>(res);
}

export async function deleteAllDrafts(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/drafts/`, {
    method: "DELETE",
    headers: BASE_HEADERS,
  });

  await handleResponse<null>(res);
}
