"use client";

import { useQuery } from "@tanstack/react-query";

import { listProposals } from "@/services/proposal";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

/**
 * Stable query key factory for per-client proposal lists.
 * Export this to call queryClient.invalidateQueries({ queryKey: clientProposalsQueryKey(id) })
 * wherever proposals are created, updated, or deleted.
 */
export const clientProposalsQueryKey = (clientId: number): [string, number] => [
  "client-proposals",
  clientId,
];

const STALE_TIME_MS = 60 * 1000;
const GC_TIME_MS = 10 * 60 * 1000;

interface UseClientProposalsQueryReturn {
  proposals: ProposalListItem[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * React Query hook for fetching proposals by client.
 *
 * Cache behaviour:
 *   - Fresh (< 60 s) → served from cache, no network request.
 *   - Stale (60 s – 10 min) → returns cached data immediately, refetches in background.
 *   - Expired (> 10 min) → fetches fresh data, shows loading state.
 *   - Window focus → triggers background refetch when stale.
 *
 * Deduplication: multiple components subscribing to the same clientId share one
 * in-flight request and the same cached result — no duplicate network calls.
 */
export function useClientProposalsQuery(clientId: number): UseClientProposalsQueryReturn {
  const { data, isLoading, isFetching, isError, error } = useQuery<ProposalListItem[], Error>({
    queryKey: clientProposalsQueryKey(clientId),
    queryFn: () => listProposals({ clientId }),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: true,
    enabled: clientId > 0,
  });

  return {
    proposals: data ?? [],
    isLoading,
    isFetching,
    isError,
    error: error ?? null,
  };
}
