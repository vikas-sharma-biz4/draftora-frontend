/**
 * This store provides:
 * - Centralized client state across the application
 * - Smart caching with configurable TTL
 * - Optimistic updates for mutations
 * - Automatic cache invalidation
 * - Prevention of duplicate API calls
 * - localStorage persistence via Zustand persist middleware (standardized with other stores)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Client,
  ClientWithDocuments,
  ClientDocument,
  CreateClientRequest,
  UpdateClientRequest,
} from "@/services/client.service";
import * as clientApi from "@/services/client.service";
import { HttpError } from "@/config/httpClient";
import { CLIENTS_STORAGE_KEY } from "@/constants";
import { logger } from "@/utils/logger";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const INITIAL_CLIENT_STATE = {
  clients: [] as ClientWithDocuments[],
  isLoading: false,
  isInitialized: false,
  lastFetched: null as number | null,
  error: null as string | null,
  total: 0,
};

interface ClientState {
  // State
  clients: ClientWithDocuments[];
  isLoading: boolean;
  isInitialized: boolean;
  lastFetched: number | null;
  error: string | null;
  total: number;

  // Computed
  isCacheValid: () => boolean;
  getClientById: (id: number) => ClientWithDocuments | undefined;

  // Actions
  fetchClients: (force?: boolean) => Promise<void>;
  setClients: (clients: ClientWithDocuments[]) => void;
  addClient: (client: ClientWithDocuments) => void;
  updateClientLocally: (id: number, updates: Partial<Client>) => void;
  removeClient: (id: number) => void;
  invalidateCache: () => void;

  // Document actions
  addDocument: (clientId: number, document: ClientDocument) => void;
  removeDocument: (clientId: number, documentId: number) => void;
  updateDocument: (clientId: number, documentId: number, updates: Partial<ClientDocument>) => void;

  // Mutation wrappers
  createClient: (data: CreateClientRequest) => Promise<{ id: number; name: string }>;
  updateClient: (clientId: number, data: UpdateClientRequest) => Promise<Client>;
  deleteClient: (clientId: number) => Promise<void>;
  uploadDocument: (clientId: number, file: File) => Promise<ClientDocument | undefined>;
  deleteDocument: (clientId: number, documentId: number) => Promise<void>;
  reset: () => void;
}

export const useClientStore = create<ClientState>()(
  persist(
    (set, get) => ({
      ...INITIAL_CLIENT_STATE,

      // Computed
      isCacheValid: () => {
        const { lastFetched, isInitialized } = get();
        if (!isInitialized || lastFetched === null) return false;
        return Date.now() - lastFetched < CACHE_TTL_MS;
      },

      getClientById: (id: number) => {
        return get().clients.find((c) => c.id === id);
      },

      // Actions
      fetchClients: async (force = false) => {
        const { isCacheValid, isLoading } = get();

        if (!force && isCacheValid()) {
          return;
        }

        if (isLoading) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const clients = await clientApi.listClientsFullData();
          set({
            clients,
            isLoading: false,
            isInitialized: true,
            lastFetched: Date.now(),
            error: null,
            total: clients.length,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch clients";
          logger.error("[clientSlice] Failed to fetch clients:", error);
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
          total: clients.length,
        });
      },

      addClient: (client: ClientWithDocuments) => {
        set((state) => ({
          clients: [client, ...state.clients],
          lastFetched: Date.now(),
          total: state.total + 1,
        }));
      },

      updateClientLocally: (id: number, updates: Partial<Client>) => {
        set((state) => ({
          clients: state.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
          lastFetched: Date.now(),
        }));
      },

      removeClient: (id: number) => {
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
          lastFetched: Date.now(),
          total: Math.max(0, state.total - 1),
        }));
      },

      invalidateCache: () => {
        set({
          lastFetched: null,
          isInitialized: false,
        });
      },

      reset: () => {
        set(INITIAL_CLIENT_STATE);
      },

      // Document actions
      addDocument: (clientId: number, document: ClientDocument) => {
        logger.debug("[clientSlice] addDocument called:", {
          clientId,
          documentId: document.id,
          documentName: document.name,
        });
        set((state) => {
          const clients = [...state.clients];
          const clientIndex = clients.findIndex((c) => c.id === clientId);

          if (clientIndex >= 0) {
            clients[clientIndex] = {
              ...clients[clientIndex],
              documents: [...(clients[clientIndex].documents || []), document],
            };
            logger.debug("[clientSlice] Document added to existing client:", {
              clientId,
              documentId: document.id,
              totalDocuments: clients[clientIndex].documents.length,
            });
          } else {
            const mockClient: ClientWithDocuments = {
              id: clientId,
              name: `Client ${clientId}`,
              industry: "Unknown",
              status: "active",
              notes: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              documents: [document],
            };
            clients.push(mockClient);
            logger.debug("[clientSlice] Mock client created with document:", {
              clientId,
              documentId: document.id,
            });
          }

          return {
            ...state,
            clients,
            lastFetched: Date.now(),
          };
        });
      },

      removeDocument: (clientId: number, documentId: number) => {
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === clientId
              ? { ...c, documents: c.documents.filter((d) => d.id !== documentId) }
              : c
          ),
        }));
      },

      updateDocument: (clientId: number, documentId: number, updates: Partial<ClientDocument>) => {
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  documents: c.documents.map((d) =>
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
        const newClient = await clientApi.createClient(data);
        const fullClient = await clientApi.getClient(newClient.id);
        get().addClient(fullClient);
        return newClient;
      },

      updateClient: async (clientId: number, data: UpdateClientRequest) => {
        const updatedClient = await clientApi.updateClient(clientId, data);
        get().updateClientLocally(clientId, updatedClient);
        return updatedClient;
      },

      deleteClient: async (clientId: number) => {
        try {
          await clientApi.deleteClient(clientId);
          get().removeClient(clientId);
        } catch (error) {
          if (error instanceof HttpError && error.statusCode === 404) {
            logger.warn(
              "[clientSlice] Client not found on delete (likely already deleted), removing from store:",
              clientId
            );
            get().removeClient(clientId);
            return;
          }
          throw error;
        }
      },

      uploadDocument: async (clientId: number, file: File) => {
        try {
          const document = await clientApi.uploadDocument(clientId, file);
          const documentWithSize = {
            ...document,
            sizeBytes: document.sizeBytes || file.size,
          };
          get().addDocument(clientId, documentWithSize);
          return documentWithSize;
        } catch (error) {
          if (error instanceof HttpError && error.statusCode === 404) {
            logger.warn(
              "[clientSlice] Client not found for document upload (likely already deleted):",
              clientId
            );
            return undefined;
          }
          logger.error("[clientSlice] Failed to upload document:", error);
          throw error;
        }
      },

      deleteDocument: async (clientId: number, documentId: number) => {
        const snapshot = get().clients;
        get().removeDocument(clientId, documentId); // optimistic remove
        try {
          await clientApi.deleteDocument(clientId, documentId);
        } catch (error) {
          set({ clients: snapshot }); // rollback on failure
          logger.error("[clientSlice] Failed to delete document:", error);
          throw error; // caller shows toast
        }
      },
    }),
    {
      name: CLIENTS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist the client list and cache timestamp
      partialize: (state) => ({
        clients: state.clients,
        lastFetched: state.lastFetched,
        total: state.total,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.clients.length > 0) {
          state.isInitialized = true;
        }
      },
    }
  )
);
