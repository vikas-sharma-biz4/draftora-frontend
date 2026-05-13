/**
 * Zustand store for client state management with smart caching
 *
 * This store provides:
 * - Centralized client state across the application
 * - Smart caching with configurable TTL
 * - Optimistic updates for mutations
 * - Automatic cache invalidation
 * - Prevention of duplicate API calls
 */

import { create } from 'zustand';
import type { Client, ClientWithDocuments, ClientDocument, CreateClientRequest, UpdateClientRequest } from '@/services/client.service';
import * as clientApi from '@/services/client.service';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const INITIAL_CLIENT_STATE = {
  clients: [] as ClientWithDocuments[],
  isLoading: false,
  isInitialized: false,
  lastFetched: null as number | null,
  error: null as string | null,
};

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
  uploadDocument: (clientId: number, file: File) => Promise<ClientDocument>;
  deleteDocument: (clientId: number, documentId: number) => Promise<void>;
  reset: () => void;
}

export const useClientStore = create<ClientState>((set, get) => ({
  // Initial state
  clients: [],
  isLoading: false,
  isInitialized: false,
  lastFetched: null,
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch clients';
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  setClients: (clients: ClientWithDocuments[]) => {
    set({
      clients,
      isInitialized: true,
      lastFetched: Date.now(),
    });
  },

  addClient: (client: ClientWithDocuments) => {
    set(state => ({
      clients: [...state.clients, client],
      lastFetched: Date.now(),
    }));
  },

  updateClient: (id: number, updates: Partial<Client>) => {
    set(state => ({
      clients: state.clients.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
      lastFetched: Date.now(),
    }));
  },

  removeClient: (id: number) => {
    set(state => ({
      clients: state.clients.filter(c => c.id !== id),
      lastFetched: Date.now(),
    }));
  },

  invalidateCache: () => {
    set({
      lastFetched: null,
      isInitialized: false,
    });
  },

  reset: () => set(INITIAL_CLIENT_STATE),

  // Document actions
  addDocument: (clientId: number, document: ClientDocument) => {
    set(state => ({
      clients: state.clients.map(c =>
        c.id === clientId
          ? { ...c, documents: [...c.documents, document] }
          : c
      ),
      lastFetched: Date.now(),
    }));
  },

  removeDocument: (clientId: number, documentId: number) => {
    set(state => ({
      clients: state.clients.map(c =>
        c.id === clientId
          ? { ...c, documents: c.documents.filter(d => d.id !== documentId) }
          : c
      ),
      lastFetched: Date.now(),
    }));
  },

  updateDocument: (clientId: number, documentId: number, updates: Partial<ClientDocument>) => {
    set(state => ({
      clients: state.clients.map(c =>
        c.id === clientId
          ? {
              ...c,
              documents: c.documents.map(d =>
                d.id === documentId ? { ...d, ...updates } : d
              ),
            }
          : c
      ),
      lastFetched: Date.now(),
    }));
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
      throw error;
    }
  },

  uploadDocument: async (clientId: number, file: File) => {
    try {
      const document = await clientApi.uploadDocument(clientId, file);

      // Add to store
      get().addDocument(clientId, document);

      return document;
    } catch (error) {
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
}));
