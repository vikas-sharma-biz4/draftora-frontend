/**
 * Client API service for managing clients and documents
 */

import { http } from "@/config/httpClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Client {
  id: number;
  name: string;
  industry: string;
  status: "active" | "inactive";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDocument {
  id: number;
  clientId: number;
  name: string;
  fileType: string;
  sizeBytes: number;
  status: "processing" | "parsed" | "error";
  createdAt: string;
  updatedAt: string;
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

// ─── Client CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new client
 */
export async function createClient(
  data: CreateClientRequest
): Promise<{ id: number; name: string }> {
  return http.post<{ id: number; name: string }>("/clients", data);
}

/**
 * List all active clients
 */
export async function listClients(): Promise<Client[]> {
  return http.get<Client[]>("/clients");
}

/**
 * Get a single client with documents
 */
export async function getClient(clientId: number): Promise<ClientWithDocuments> {
  return http.get<ClientWithDocuments>(`/clients/${clientId}`);
}

/**
 * Update a client
 */
export async function updateClient(
  clientId: number,
  data: UpdateClientRequest
): Promise<Client> {
  return http.patch<Client>(`/clients/${clientId}`, data);
}

/**
 * Delete a client (soft delete)
 */
export async function deleteClient(clientId: number): Promise<void> {
  await http.delete<null>(`/clients/${clientId}`);
}

// ─── Caching ──────────────────────────────────────────────────────────────────
// NOTE: All caching is now handled by Zustand clientSlice for SSR safety.
//       The functions below are kept for backward compatibility but no longer cache.

/**
 * List all clients with full documents array in a single API call.
 */
export async function listClientsFullData(): Promise<ClientWithDocuments[]> {
  return http.get<ClientWithDocuments[]>("/clients/full-data");
}

/**
 * Fetches all clients with their documents.
 * @deprecated Use useClientStore().fetchClients() instead for SSR-safe caching.
 */
export async function listClientsWithDocuments(): Promise<ClientWithDocuments[]> {
  return listClientsFullData();
}

/**
 * @deprecated Use useClientStore().invalidateCache() instead.
 */
export function invalidateClientsCache(): void {
  // No-op: caching is now handled by Zustand clientSlice
}

// ─── Document Management ──────────────────────────────────────────────────────

/**
 * Upload and parse a document for a client
 */
export async function uploadDocument(
  clientId: number,
  file: File
): Promise<ClientDocument> {
  const formData = new FormData();
  formData.append("file", file);

  return http.post<ClientDocument>(`/clients/${clientId}/documents`, formData);
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(
  clientId: number,
  documentId: number
): Promise<void> {
  await http.delete<null>(`/clients/${clientId}/documents/${documentId}`);
}
