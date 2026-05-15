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

// Raw API response interface (snake_case)
interface ClientApiResponse {
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
  clientId: number;
  name: string;
  fileType: string;
  sizeBytes: number;
  status: "processing" | "parsed" | "error";
  createdAt: string;
  updatedAt: string;
}

// Raw API response interface for document (snake_case)
interface ClientDocumentApiResponse {
  id: number;
  client_id: number;
  name: string;
  file_type: string;
  size_bytes: number;
  status: "processing" | "parsed" | "error";
  created_at: string;
  updated_at: string;
}

// ─── Data Transformation Helpers ─────────────────────────────────────────────────

/**
 * Transform API response (snake_case) to frontend model (camelCase)
 */
function transformClient(apiClient: ClientApiResponse): Client {
  return {
    id: apiClient.id,
    name: apiClient.name,
    industry: apiClient.industry,
    status: apiClient.status,
    notes: apiClient.notes,
    createdAt: apiClient.created_at,
    updatedAt: apiClient.updated_at,
  };
}

/**
 * Transform API document response (snake_case) to frontend model (camelCase)
 */
function transformClientDocument(apiDoc: ClientDocumentApiResponse): ClientDocument {
  return {
    id: apiDoc.id,
    clientId: apiDoc.client_id,
    name: apiDoc.name,
    fileType: apiDoc.file_type,
    sizeBytes: apiDoc.size_bytes,
    status: apiDoc.status,
    createdAt: apiDoc.created_at,
    updatedAt: apiDoc.updated_at,
  };
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
  const clients = await http.get<ClientApiResponse[]>("/clients");
  return clients.map(transformClient);
}

/**
 * Get a single client with documents
 */
export async function getClient(clientId: number): Promise<ClientWithDocuments> {
  const clientData = await http.get<
    ClientApiResponse & { documents: ClientDocumentApiResponse[] }
  >(`/clients/${clientId}`);
  return {
    ...transformClient(clientData),
    documents: clientData.documents.map(transformClientDocument),
  };
}

/**
 * Update a client
 */
export async function updateClient(
  clientId: number,
  data: UpdateClientRequest
): Promise<Client> {
  const response = await http.patch<ClientApiResponse>(`/clients/${clientId}`, data);
  return transformClient(response);
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
  const response = await http.get<{
    success: boolean;
    data: {
      success: boolean;
      data: (ClientApiResponse & { documents: ClientDocumentApiResponse[] })[];
      meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
      };
      message: string;
    };
    message: string;
  }>("/clients/full-data?page=1&per_page=50");
  console.log('[client.service] Full data API response:', response);
  const clients = response.data.data;
  console.log('[client.service] Clients array:', clients);
  return clients.map(clientData => ({
    ...transformClient(clientData),
    documents: clientData.documents.map(transformClientDocument),
  }));
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

  const response = await http.post<ClientDocumentApiResponse>(`/clients/${clientId}/documents`, formData);
  return transformClientDocument(response);
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
