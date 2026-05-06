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
  file_type: string;
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

// ─── Client Cache ─────────────────────────────────────────────────────────────

let _cachedClientsWithDocs: ClientWithDocuments[] | null = null;
let _cacheTimestamp = 0;
let _inflightPromise: Promise<ClientWithDocuments[]> | null = null;
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns the cached client list (with documents), or null if not populated / expired.
 */
export function getCachedClientsWithDocuments(): ClientWithDocuments[] | null {
  if (_cachedClientsWithDocs === null) return null;
  if (Date.now() - _cacheTimestamp > CLIENT_CACHE_TTL_MS) {
    _cachedClientsWithDocs = null;
    return null;
  }
  return _cachedClientsWithDocs;
}

/**
 * Clears the client cache so the next listClientsWithDocuments() call hits the API.
 * Call this after creating, updating, or deleting a client or document.
 */
export function invalidateClientsCache(): void {
  _cachedClientsWithDocs = null;
  _cacheTimestamp = 0;
  _inflightPromise = null;
}

/**
 * List all clients with full documents array in a single API call.
 */
export async function listClientsFullData(): Promise<ClientWithDocuments[]> {
  const res = await fetch(`${API_BASE_URL}/clients/full-data`, {
    method: "GET",
    headers: BASE_HEADERS,
  });

  return handleResponse<ClientWithDocuments[]>(res);
}

/**
 * Fetches all clients with their documents.
 * Returns cached data immediately if available and not expired; otherwise fetches from API.
 */
export async function listClientsWithDocuments(): Promise<ClientWithDocuments[]> {
  const cached = getCachedClientsWithDocuments();
  if (cached !== null) return cached;

  // Deduplicate concurrent callers — all share the same in-flight request
  if (_inflightPromise !== null) return _inflightPromise;

  _inflightPromise = (async () => {
    try {
      const clientsWithDocs = await listClientsFullData();
      _cachedClientsWithDocs = clientsWithDocs;
      _cacheTimestamp = Date.now();
      return clientsWithDocs;
    } finally {
      _inflightPromise = null;
    }
  })();

  return _inflightPromise;
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
