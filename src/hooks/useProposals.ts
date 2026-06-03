/**
 * Custom hook for accessing proposal state
 *
 * Provides automatic data fetching and memoized selectors
 */

import { useEffect, useMemo, useCallback } from "react";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

interface UseProposalsOptions {
  autoFetch?: boolean;
  force?: boolean;
  filter?: "all" | "history" | "approved" | "rejected" | "pending";
}

interface UseProposalsReturn {
  proposals: ProposalListItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isInitialized: boolean;
  error: string | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
  fetchMore: () => Promise<void>;
  getProposalById: (id: number) => ProposalListItem | undefined;
}

export function useProposals(options: UseProposalsOptions = {}): UseProposalsReturn {
  const { autoFetch = true, force = false, filter = "all" } = options;

  const allProposals = useProposalStore((state) => state.proposals);
  // Subscribe to historyProposals for reactive updates when filter targets history data
  const historyProposals = useProposalStore((state) => state.historyProposals);
  const isLoading = useProposalStore((state) => state.isLoading);
  const isLoadingMore = useProposalStore((state) => state.isLoadingMore);
  const isInitialized = useProposalStore((state) => state.isInitialized);
  const error = useProposalStore((state) => state.error);
  const hasMore = useProposalStore((state) => state.hasMore);
  const fetchProposals = useProposalStore((state) => state.fetchProposals);
  const fetchMoreProposals = useProposalStore((state) => state.fetchMoreProposals);
  const fetchProposalHistory = useProposalStore((state) => state.fetchProposalHistory);
  const getProposalById = useProposalStore((state) => state.getProposalById);

  useEffect(() => {
    if (autoFetch) {
      if (filter === "history") {
        fetchProposalHistory(force);
      } else {
        fetchProposals(force);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, force, filter]);

  usePageVisibility(() => {
    if (!autoFetch) return;
    if (filter === "history") {
      void fetchProposalHistory();
    } else {
      void fetchProposals();
    }
  });

  // Derive the filtered list directly from the subscribed arrays so useMemo
  // re-runs whenever allProposals or historyProposals change.
  const proposals = useMemo(() => {
    switch (filter) {
      case "history":
        return historyProposals;
      case "approved":
        return historyProposals.filter((p) => p.approvalStatus === "approved");
      case "rejected":
        return historyProposals.filter((p) => p.approvalStatus === "rejected");
      case "pending":
        return allProposals.filter((p) => p.approvalStatus === "pending");
      default:
        return allProposals;
    }
  }, [filter, allProposals, historyProposals]);

  const refetch = useCallback(async () => {
    if (filter === "history") {
      await fetchProposalHistory(true);
    } else {
      await fetchProposals(true);
    }
  }, [filter, fetchProposals, fetchProposalHistory]);

  const fetchMore = useCallback(async () => {
    await fetchMoreProposals();
  }, [fetchMoreProposals]);

  return {
    proposals,
    isLoading,
    isLoadingMore,
    isInitialized,
    error,
    hasMore,
    refetch,
    fetchMore,
    getProposalById,
  };
}
