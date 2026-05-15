/**
 * This store provides:
 * - Centralized client state across the application
 * - Smart caching with configurable TTL
 * - Optimistic updates for mutations
 * - Automatic cache invalidation
 * - Prevention of duplicate API calls
 * - LocalStorage persistence for offline access
 */

import { create } from 'zustand';
import type { Client, ClientWithDocuments, ClientDocument, CreateClientRequest, UpdateClientRequest } from '@/services/client.service';
import * as clientApi from '@/services/client.service';
import { logger } from '@/utils/logger';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOCAL_STORAGE_KEY = 'draftora_clients_cache';
const LOCAL_STORAGE_TIMESTAMP_KEY = 'draftora_clients_timestamp';

// ─── LocalStorage Helpers ─────────────────────────────────────────────────────

/**
 * Check if we're in a browser environment
 */
const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

/**
 * Load clients from localStorage
 */
function loadClientsFromLocalStorage(): ClientWithDocuments[] | null {
  if (!isBrowser) return null;

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    console.warn('[clientSlice] Failed to load clients from localStorage:', error);
    return null;
  }
}

/**
 * Save clients to localStorage
 */
function saveClientsToLocalStorage(clients: ClientWithDocuments[]): void {
  if (!isBrowser) return;

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clients));
    localStorage.setItem(LOCAL_STORAGE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.warn('[clientSlice] Failed to save clients to localStorage:', error);
  }
}

/**
 * Clear clients from localStorage
 */
function clearClientsFromLocalStorage(): void {
  if (!isBrowser) return;

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_TIMESTAMP_KEY);
  } catch (error) {
    console.warn('[clientSlice] Failed to clear clients from localStorage:', error);
  }
}

export const INITIAL_CLIENT_STATE = {
  clients: [] as ClientWithDocuments[],
  isLoading: false,
  isInitialized: false,
  lastFetched: null as number | null,
  error: null as string | null,
};

// Load from localStorage on initialization
const cachedClients = loadClientsFromLocalStorage();
const cachedTimestamp = isBrowser ? localStorage.getItem(LOCAL_STORAGE_TIMESTAMP_KEY) : null;
const initialClients = cachedClients || [];
const initialLastFetched = cachedTimestamp ? parseInt(cachedTimestamp, 10) : null;

interface ClientState {
  // State
  clients: ClientWithDocuments[];
  isLoading: boolean;
  isInitialized: boolean;
  lastFetched: number | null;
  error: string | null;

  // Computed
  isCacheValid: () => boolean;
  getClientById: (id: number) => ClientWithDocuments | undefined;

  // Actions
  fetchClients: (force?: boolean) => Promise<void>;
  setClients: (clients: ClientWithDocuments[]) => void;
  addClient: (client: ClientWithDocuments) => void;
  updateClient: (id: number, updates: Partial<Client>) => void;
  removeClient: (id: number) => void;
  invalidateCache: () => void;

  // Document actions
  addDocument: (clientId: number, document: ClientDocument) => void;
  removeDocument: (clientId: number, documentId: number) => void;
  updateDocument: (clientId: number, documentId: number, updates: Partial<ClientDocument>) => void;

  // Mutation wrappers
  createClient: (data: CreateClientRequest) => Promise<{ id: number; name: string }>;
  updateClientApi: (clientId: number, data: UpdateClientRequest) => Promise<Client>;
  deleteClient: (clientId: number) => Promise<void>;
  uploadDocument: (clientId: number, file: File) => Promise<ClientDocument | undefined>;
  deleteDocument: (clientId: number, documentId: number) => Promise<void>;
  reset: () => void;
}

export const useClientStore = create<ClientState>((set, get) => ({
  // Initial state - load from localStorage if available
  clients: initialClients,
  isLoading: false,
  isInitialized: !!cachedClients,
  lastFetched: initialLastFetched,
  error: null,

  // Computed
  isCacheValid: () => {
    const { lastFetched, isInitialized } = get();
    if (!isInitialized || lastFetched === null) return false;
    return Date.now() - lastFetched < CACHE_TTL_MS;
  },

  getClientById: (id: number) => {
    return get().clients.find(c => c.id === id);
  },

  // Actions
  fetchClients: async (force = false) => {
    const { isCacheValid, isLoading } = get();

    // Return cached data if valid and not forced
    if (!force && isCacheValid()) {
      return;
    }

    // Prevent duplicate concurrent requests
    if (isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const clients = await clientApi.listClientsFullData();
      console.log('[clientSlice] Fetched clients:', clients);
      console.log('[clientSlice] Is array?', Array.isArray(clients));
      set({
        clients,
        isLoading: false,
        isInitialized: true,
        lastFetched: Date.now(),
        error: null,
      });
      // Save to localStorage for persistence
      saveClientsToLocalStorage(clients);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch clients';
      set({
        isLoading: false,
        error: errorMessage,
      });
      // Don't re-throw - silently fail and let components handle the error state
      console.warn('[clientSlice] Failed to fetch clients:', errorMessage);
    }
  },

  setClients: (clients: ClientWithDocuments[]) => {
    set({
      clients,
      isInitialized: true,
      lastFetched: Date.now(),
    });
    saveClientsToLocalStorage(clients);
  },

  addClient: (client: ClientWithDocuments) => {
    set(state => {
      const updatedClients = [...state.clients, client];
      saveClientsToLocalStorage(updatedClients);
      return ({
        clients: updatedClients,
        lastFetched: Date.now(),
      });
    });
  },

  updateClient: (id: number, updates: Partial<Client>) => {
    set(state => {
      const updatedClients = state.clients.map(c =>
        c.id === id ? { ...c, ...updates } : c
      );
      saveClientsToLocalStorage(updatedClients);
      return ({
        clients: updatedClients,
        lastFetched: Date.now(),
      });
    });
  },

  removeClient: (id: number) => {
    set(state => {
      const updatedClients = state.clients.filter(c => c.id !== id);
      saveClientsToLocalStorage(updatedClients);
      return ({
        clients: updatedClients,
        lastFetched: Date.now(),
      });
    });
  },

  invalidateCache: () => {
    set({
      lastFetched: null,
      isInitialized: false,
    });
  },

  reset: () => {
    clearClientsFromLocalStorage();
    set(INITIAL_CLIENT_STATE);
  },

  // Document actions
  addDocument: (clientId: number, document: ClientDocument) => {
    logger.debug('[clientSlice] addDocument called:', { clientId, documentId: document.id, documentName: document.name });
    set(state => {
      const clients = [...state.clients];
      const clientIndex = clients.findIndex(c => c.id === clientId);

      if (clientIndex >= 0) {
        // Client exists, add document
        clients[clientIndex] = {
          ...clients[clientIndex],
          documents: [...(clients[clientIndex].documents || []), document]
        };
        logger.debug('[clientSlice] Document added to existing client:', {
          clientId,
          documentId: document.id,
          totalDocuments: clients[clientIndex].documents.length
        });
      } else {
        // Client doesn't exist, create it with the document
        const mockClient: ClientWithDocuments = {
          id: clientId,
          name: `Client ${clientId}`,
          industry: 'Unknown',
          status: 'active',
          notes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [document]
        };
        clients.push(mockClient);
        logger.debug('[clientSlice] Mock client created with document:', { clientId, documentId: document.id });
      }

      saveClientsToLocalStorage(clients);
      return {
        ...state,
        clients,
        lastFetched: Date.now(),
      };
    });
  },

  removeDocument: (clientId: number, documentId: number) => {
    set(state => {
      const updatedClients = state.clients.map(c =>
        c.id === clientId
          ? { ...c, documents: c.documents.filter(d => d.id !== documentId) }
          : c
      );
      saveClientsToLocalStorage(updatedClients);
      return {
        clients: updatedClients,
        lastFetched: Date.now(),
      };
    });
  },

  updateDocument: (clientId: number, documentId: number, updates: Partial<ClientDocument>) => {
    set(state => {
      const updatedClients = state.clients.map(c =>
        c.id === clientId
          ? {
              ...c,
              documents: c.documents.map(d =>
                d.id === documentId ? { ...d, ...updates } : d
              ),
            }
          : c
      );
      saveClientsToLocalStorage(updatedClients);
      return {
        clients: updatedClients,
        lastFetched: Date.now(),
      };
    });
  },

  // Mutation wrappers with optimistic updates
  createClient: async (data: CreateClientRequest) => {
    try {
      const newClient = await clientApi.createClient(data);

      // Fetch full client data with documents
      const fullClient = await clientApi.getClient(newClient.id);

      // Add to store
      get().addClient(fullClient);

      return newClient;
    } catch (error) {
      throw error;
    }
  },

  updateClientApi: async (clientId: number, data: UpdateClientRequest) => {
    try {
      const updatedClient = await clientApi.updateClient(clientId, data);

      // Update in store
      get().updateClient(clientId, updatedClient);

      return updatedClient;
    } catch (error) {
      throw error;
    }
  },

  deleteClient: async (clientId: number) => {
    try {
      await clientApi.deleteClient(clientId);

      // Remove from store
      get().removeClient(clientId);
    } catch (error) {
      // If client not found (404), it was likely already deleted - just remove from store
      if (error instanceof Error && 'statusCode' in error && (error as any).statusCode === 404) {
        logger.warn('[clientSlice] Client not found on delete (likely already deleted), removing from store:', clientId);
        get().removeClient(clientId);
        return;
      }
      throw error;
    }
  },

  uploadDocument: async (clientId: number, file: File) => {
    try {
      console.log('[clientSlice] Uploading document:', { clientId, fileName: file.name, fileSize: file.size });
      const document = await clientApi.uploadDocument(clientId, file);
      console.log('[clientSlice] Document uploaded successfully:', { clientId, documentId: document.id, documentName: document.name, backendSize: document.sizeBytes });

      // Ensure sizeBytes is set correctly - use backend value if available, otherwise use file.size
      const documentWithSize = {
        ...document,
        sizeBytes: document.sizeBytes || file.size,
      };

      // Add to store
      get().addDocument(clientId, documentWithSize);

      return documentWithSize;
    } catch (error) {
      // If client not found (404), it was likely already deleted - just log a warning
      if (error instanceof Error && 'statusCode' in error && (error as any).statusCode === 404) {
        logger.warn('[clientSlice] Client not found for document upload (likely already deleted), cannot upload document:', clientId);
        return;
      }
      console.error('[clientSlice] Failed to upload document:', error);
      throw error;
    }
  },

  deleteDocument: async (clientId: number, documentId: number) => {
    try {
      await clientApi.deleteDocument(clientId, documentId);

      // Remove from store
      get().removeDocument(clientId, documentId);
    } catch (error) {
      throw error;
    }
  },
}))
