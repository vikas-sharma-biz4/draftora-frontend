/**
 * Client API service for managing clients and documents
 */

import { API_BASE_URL } from "@/config/config";

// ngrok free tier shows an HTML interstitial page for browser fetch requests.
// This header bypasses it so API calls get JSON responses instead of HTML.
const BASE_HEADERS: Record<string, string> = {};
if (process.env.NODE_ENV === "development") {
  BASE_HEADERS["ngrok-skip-browser-warning"] = "1";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Client {
  id: number;
  name: string;
  industry: string;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDocument {
  id: number;
  client_id: number;
  name: string;
  file_type: "pdf" | "docx" | "xlsx" | "pptx";
  size_bytes: number;
  status: "processing" | "parsed" | "error";
  created_at: string;
  updated_at: string;
}

export interface ClientWithDocuments extends Client {
  documents: ClientDocument[];
}

export interface CreateClientRequest {
  name: string;
  industry: string;
  notes?: string;
}

export interface UpdateClientRequest {
  name?: string;
  industry?: string;
  status?: "active" | "inactive";
  notes?: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.success) {
    const message: string =
      json?.error?.message ?? `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return json.data as T;
}

// ─── Client CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new client
 */
export async function createClient(
  data: CreateClientRequest
): Promise<{ id: number; name: string }> {
  const res = await fetch(`${API_BASE_URL}/clients`, {
    method: "POST",
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return handleResponse<{ id: number; name: string }>(res);
}

/**
 * List all active clients
 */
export async function listClients(): Promise<Client[]> {
  const res = await fetch(`${API_BASE_URL}/clients`, {
    method: "GET",
    headers: BASE_HEADERS,
  });

  return handleResponse<Client[]>(res);
}

/**
 * Get a single client with documents
 */
export async function getClient(clientId: number): Promise<ClientWithDocuments> {
  const res = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
    method: "GET",
    headers: BASE_HEADERS,
  });

  return handleResponse<ClientWithDocuments>(res);
}

/**
 * Update a client
 */
export async function updateClient(
  clientId: number,
  data: UpdateClientRequest
): Promise<Client> {
  const res = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
    method: "PATCH",
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return handleResponse<Client>(res);
}

/**
 * Delete a client (soft delete)
 */
export async function deleteClient(clientId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
    method: "DELETE",
    headers: BASE_HEADERS,
  });

  if (!res.ok) {
    throw new Error(`Failed to delete client: ${res.status}`);
  }
}

// ─── Document Management ──────────────────────────────────────────────────────

/**
 * Upload and parse a document for a client
 */
export async function uploadDocument(
  clientId: number,
  file: File
): Promise<{ id: number; name: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/clients/${clientId}/documents`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: formData,
  });

  return handleResponse<{ id: number; name: string; status: string }>(res);
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(
  clientId: number,
  documentId: number
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/clients/${clientId}/documents/${documentId}`,
    {
      method: "DELETE",
      headers: BASE_HEADERS,
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to delete document: ${res.status}`);
  }
}
