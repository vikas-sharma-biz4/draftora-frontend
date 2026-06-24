/**
 * Client API service for managing clients and documents
 */

import { http } from "@/config/httpClient";
import type {
  Client,
  ClientDocument,
  ClientWithDocuments,
  CreateClientRequest,
  UpdateClientRequest,
} from "@/interfaces/clientInterfaces";

// Re-export so existing imports from this module continue to work
export type {
  Client,
  ClientDocument,
  ClientWithDocuments,
  CreateClientRequest,
  UpdateClientRequest,
};

// ─── Internal API response shapes (snake_case) ────────────────────────────────

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

// Raw API response interface for document (snake_case)
interface ClientDocumentApiResponse {
  id: number;
  client_id: number;
  name: string;
  file_type: string;
  size_bytes: number;
  status: "processing" | "parsed" | "error";
  s3_file_url?: string;
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
    s3FileUrl: apiDoc.s3_file_url,
    createdAt: apiDoc.created_at,
    updatedAt: apiDoc.updated_at,
  };
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
  const clientData = await http.get<ClientApiResponse & { documents: ClientDocumentApiResponse[] }>(
    `/clients/${clientId}`
  );
  return {
    ...transformClient(clientData),
    documents: clientData.documents.map(transformClientDocument),
  };
}

/**
 * Update a client
 */
export async function updateClient(clientId: number, data: UpdateClientRequest): Promise<Client> {
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
 * List all clients with full documents array, automatically fetching all pages.
 * Page 1 is fetched first to obtain total_pages; remaining pages are then
 * fetched in parallel so N pages cost one serial RTT + one parallel batch
 * instead of N sequential RTTs.
 * @param includeDeleted - If true, includes soft-deleted clients (for debugging)
 */
export async function listClientsFullData(
  includeDeleted: boolean = false
): Promise<ClientWithDocuments[]> {
  const perPage = 50; // Maximum allowed by backend
  const queryBase = `/clients/full-data?per_page=${perPage}${includeDeleted ? "&include_deleted=true" : ""}`;

  type RawClient = ClientApiResponse & { documents: ClientDocumentApiResponse[] };

  const transformPage = (data: RawClient[]): ClientWithDocuments[] =>
    data.map((clientData) => ({
      ...transformClient(clientData),
      documents: clientData.documents.map(transformClientDocument),
    }));

  // Fetch page 1 to discover total_pages
  const { data: firstPageData, meta } = await http.getPaginated<RawClient>(`${queryBase}&page=1`);

  const allClients: ClientWithDocuments[] = transformPage(firstPageData);

  if (meta.total_pages <= 1) {
    return allClients;
  }

  // Fetch all remaining pages in parallel
  const remainingFetches = Array.from({ length: meta.total_pages - 1 }, (_, i) =>
    http.getPaginated<RawClient>(`${queryBase}&page=${i + 2}`)
  );

  const remainingResults = await Promise.all(remainingFetches);
  for (const { data } of remainingResults) {
    allClients.push(...transformPage(data));
  }

  return allClients;
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
export async function uploadDocument(clientId: number, file: File): Promise<ClientDocument> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await http.post<ClientDocumentApiResponse>(
    `/clients/${clientId}/documents`,
    formData
  );
  return transformClientDocument(response);
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(clientId: number, documentId: number): Promise<void> {
  await http.delete<null>(`/clients/${clientId}/documents/${documentId}`);
}

/**
 * Get a presigned S3 URL to view the original uploaded document.
 * Opens the file in the browser (PDF viewer, image preview, etc.).
 */
export async function getDocumentViewUrl(clientId: number, documentId: number): Promise<string> {
  const response = await http.get<{ view_url: string; expires_in: number }>(
    `/clients/${clientId}/documents/${documentId}/view-url`
  );
  return response.view_url;
}
