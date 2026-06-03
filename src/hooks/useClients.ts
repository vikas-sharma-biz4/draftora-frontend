/**
 * Custom hook for accessing client state
 *
 * This hook provides a clean interface to the client store with:
 * - Automatic data fetching on mount
 * - Loading and error states
 * - Memoized selectors for performance
 */

import { useEffect, useRef } from "react";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import type { ClientWithDocuments } from "@/services/client.service";

interface UseClientsOptions {
  autoFetch?: boolean;
  force?: boolean;
}

interface UseClientsReturn {
  clients: ClientWithDocuments[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getClientById: (id: number) => ClientWithDocuments | undefined;
}

export function useClients(options: UseClientsOptions = {}): UseClientsReturn {
  const { autoFetch = true, force = false } = options;

  const clients = useClientStore((state) => state.clients);
  const isLoading = useClientStore((state) => state.isLoading);
  const error = useClientStore((state) => state.error);
  const fetchClients = useClientStore((state) => state.fetchClients);
  const getClientById = useClientStore((state) => state.getClientById);

  useEffect(() => {
    if (autoFetch) {
      fetchClients(force);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, force]);

  // Re-fetch when the tab becomes visible again — respects TTL so a fresh tab
  // switch within the cache window produces no network call.
  usePageVisibility(() => {
    if (autoFetch) void fetchClients();
  });

  const refetch = async () => {
    await fetchClients(true);
  };

  return {
    clients,
    isLoading,
    error,
    refetch,
    getClientById,
  };
}

export function useClient(clientId: number): {
  client: ClientWithDocuments | undefined;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const getClientById = useClientStore((state) => state.getClientById);
  const isLoading = useClientStore((state) => state.isLoading);
  const error = useClientStore((state) => state.error);
  const fetchClients = useClientStore((state) => state.fetchClients);
  const isInitialized = useClientStore((state) => state.isInitialized);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch once on mount if not initialized
    if (!isInitialized && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const client = getClientById(clientId);

  const refetch = async () => {
    await fetchClients(true);
  };

  return {
    client,
    isLoading,
    error,
    refetch,
  };
}
