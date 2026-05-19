/**
 * Custom hook for accessing proposal state
 *
 * Provides automatic data fetching and memoized selectors
 */

import { useEffect, useMemo } from 'react';
import { useProposalStore } from '@/store/features/proposals/proposalSlice';
import type { ProposalListItem } from '@/interfaces/proposalInterfaces';

interface UseProposalsOptions {
  autoFetch?: boolean;
  force?: boolean;
  filter?: 'all' | 'history' | 'approved' | 'rejected' | 'pending';
}

interface UseProposalsReturn {
  proposals: ProposalListItem[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getProposalById: (id: number) => ProposalListItem | undefined;
}

export function useProposals(options: UseProposalsOptions = {}): UseProposalsReturn {
  const { autoFetch = true, force = false, filter = 'all' } = options;

  const allProposals = useProposalStore(state => state.proposals);
  const isLoading = useProposalStore(state => state.isLoading);
  const isInitialized = useProposalStore(state => state.isInitialized);
  const error = useProposalStore(state => state.error);
  const fetchProposals = useProposalStore(state => state.fetchProposals);
  const fetchProposalHistory = useProposalStore(state => state.fetchProposalHistory);
  const getProposalById = useProposalStore(state => state.getProposalById);
  const getHistoryProposals = useProposalStore(state => state.getHistoryProposals);
  const getApprovedProposals = useProposalStore(state => state.getApprovedProposals);
  const getRejectedProposals = useProposalStore(state => state.getRejectedProposals);
  const getPendingProposals = useProposalStore(state => state.getPendingProposals);

  useEffect(() => {
    if (autoFetch) {
      // Use dedicated history endpoint for history filter
      if (filter === 'history') {
        fetchProposalHistory(force);
      } else {
        fetchProposals(force);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, force, filter]);

  const proposals = useMemo(() => {
    switch (filter) {
      case 'history':
        return getHistoryProposals();
      case 'approved':
        return getApprovedProposals();
      case 'rejected':
        return getRejectedProposals();
      case 'pending':
        return getPendingProposals();
      default:
        return allProposals;
    }
  }, [filter, allProposals, getHistoryProposals, getApprovedProposals, getRejectedProposals, getPendingProposals]);

  const refetch = async () => {
    // Use appropriate fetch method based on filter
    if (filter === 'history') {
      await fetchProposalHistory(true);
    } else {
      await fetchProposals(true);
    }
  };

  return {
    proposals,
    isLoading,
    isInitialized,
    error,
    refetch,
    getProposalById,
  };
}
