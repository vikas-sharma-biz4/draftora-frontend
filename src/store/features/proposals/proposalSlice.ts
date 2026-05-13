/**
 * Zustand store for proposal state management with smart caching
 *
 * Shared between Dashboard and History pages to eliminate duplicate API calls
 *
 * Features:
 * - Centralized proposal state
 * - Smart caching with configurable TTL
 * - Computed selectors for filtering
 * - Automatic cache invalidation
 */

import { create } from 'zustand';
import type { ProposalListItem } from '@/interfaces/proposalInterfaces';
import * as proposalApi from '@/services/proposal.service';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export const INITIAL_PROPOSAL_STATE = {
  proposals: [] as ProposalListItem[],
  isLoading: false,
  isInitialized: false,
  lastFetched: null as number | null,
  error: null as string | null,
};

interface ProposalState {
  // State
  proposals: ProposalListItem[];
  isLoading: boolean;
  isInitialized: boolean;
  lastFetched: number | null;
  error: string | null;

  // Actions
  fetchProposals: (force?: boolean) => Promise<void>;
  setProposals: (proposals: ProposalListItem[]) => void;
  addProposal: (proposal: ProposalListItem) => void;
  updateProposal: (id: number, updates: Partial<ProposalListItem>) => void;
  removeProposal: (id: number) => void;
  invalidateCache: () => void;
  reset: () => void;
}

export const useProposalStore = create<ProposalState>((set, get) => ({
  // Initial state
  proposals: [],
  isLoading: false,
  isInitialized: false,
  lastFetched: null,
  error: null,

  // Actions
  fetchProposals: async (force = false) => {
    const { lastFetched, isInitialized, isLoading } = get();

    // Return cached data if valid and not forced
    if (!force && isInitialized && lastFetched !== null) {
      if (Date.now() - lastFetched < CACHE_TTL_MS) {
        return;
      }
    }

    // Prevent duplicate concurrent requests
    if (isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const proposals = await proposalApi.listProposals();

      // Sort by creation date (newest first)
      const sorted = [...proposals].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      set({
        proposals: sorted,
        isLoading: false,
        isInitialized: true,
        lastFetched: Date.now(),
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch proposals';
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  setProposals: (proposals: ProposalListItem[]) => {
    set({
      proposals,
      isInitialized: true,
      lastFetched: Date.now(),
    });
  },

  addProposal: (proposal: ProposalListItem) => {
    set(state => ({
      proposals: [proposal, ...state.proposals],
      lastFetched: Date.now(),
    }));
  },

  updateProposal: (id: number, updates: Partial<ProposalListItem>) => {
    set(state => ({
      proposals: state.proposals.map(p =>
        p.id === id ? { ...p, ...updates } : p
      ),
      lastFetched: Date.now(),
    }));
  },

  removeProposal: (id: number) => {
    set(state => ({
      proposals: state.proposals.filter(p => p.id !== id),
      lastFetched: Date.now(),
    }));
  },

  invalidateCache: () => {
    set({
      lastFetched: null,
      isInitialized: false,
    });
  },

  reset: () => set(INITIAL_PROPOSAL_STATE),
}));

// ─── Standalone Selectors ─────────────────────────────────────────────────────

/**
 * Pure selectors for derived state computations.
 * These are framework-agnostic and can be used with Zustand's selector API.
 */

/**
 * Selects whether the cache is still valid based on TTL.
 */
export const selectIsCacheValid = (state: ProposalState): boolean => {
  if (!state.isInitialized || state.lastFetched === null) return false;
  return Date.now() - state.lastFetched < CACHE_TTL_MS;
};

/**
 * Selects a proposal by its ID.
 */
export const selectProposalById = (id: number) => (state: ProposalState): ProposalListItem | undefined => {
  return state.proposals.find(p => p.id === id);
};

/**
 * Selects only approved proposals.
 */
export const selectApprovedProposals = (state: ProposalState): ProposalListItem[] => {
  return state.proposals.filter(p => p.approvalStatus === 'approved');
};

/**
 * Selects only rejected proposals.
 */
export const selectRejectedProposals = (state: ProposalState): ProposalListItem[] => {
  return state.proposals.filter(p => p.approvalStatus === 'rejected');
};

/**
 * Selects proposals in history (approved or rejected).
 */
export const selectHistoryProposals = (state: ProposalState): ProposalListItem[] => {
  return state.proposals.filter(
    p => p.approvalStatus === 'approved' || p.approvalStatus === 'rejected'
  );
};

/**
 * Selects only pending proposals.
 */
export const selectPendingProposals = (state: ProposalState): ProposalListItem[] => {
  return state.proposals.filter(p => p.approvalStatus === 'pending');
};

// ─── Granular Selector Hooks ─────────────────────────────────────────────────────

/**
 * Selector hooks for fine-grained Zustand subscriptions.
 *
 * Components should use these hooks to subscribe only to the specific state
 * they need, avoiding unnecessary re-renders when unrelated state changes.
 */

/**
 * Selects whether the cache is valid.
 */
export const useIsProposalCacheValid = () => useProposalStore(selectIsCacheValid);

/**
 * Selects a proposal by its ID.
 */
export const useProposalById = (id: number) => useProposalStore(selectProposalById(id));

/**
 * Selects approved proposals.
 */
export const useApprovedProposals = () => useProposalStore(selectApprovedProposals);

/**
 * Selects rejected proposals.
 */
export const useRejectedProposals = () => useProposalStore(selectRejectedProposals);

/**
 * Selects history proposals (approved or rejected).
 */
export const useHistoryProposals = () => useProposalStore(selectHistoryProposals);

/**
 * Selects pending proposals.
 */
export const usePendingProposals = () => useProposalStore(selectPendingProposals);
