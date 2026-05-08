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
import type { ProposalListItem } from '@/types/proposal.types';
import * as proposalApi from '@/api/proposalApi';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

interface ProposalState {
  // State
  proposals: ProposalListItem[];
  isLoading: boolean;
  isInitialized: boolean;
  lastFetched: number | null;
  error: string | null;
  
  // Computed selectors
  isCacheValid: () => boolean;
  getProposalById: (id: number) => ProposalListItem | undefined;
  getApprovedProposals: () => ProposalListItem[];
  getRejectedProposals: () => ProposalListItem[];
  getHistoryProposals: () => ProposalListItem[];
  getPendingProposals: () => ProposalListItem[];
  
  // Actions
  fetchProposals: (force?: boolean) => Promise<void>;
  setProposals: (proposals: ProposalListItem[]) => void;
  addProposal: (proposal: ProposalListItem) => void;
  updateProposal: (id: number, updates: Partial<ProposalListItem>) => void;
  removeProposal: (id: number) => void;
  invalidateCache: () => void;
}

export const useProposalStore = create<ProposalState>((set, get) => ({
  // Initial state
  proposals: [],
  isLoading: false,
  isInitialized: false,
  lastFetched: null,
  error: null,
  
  // Computed selectors
  isCacheValid: () => {
    const { lastFetched, isInitialized } = get();
    if (!isInitialized || lastFetched === null) return false;
    return Date.now() - lastFetched < CACHE_TTL_MS;
  },
  
  getProposalById: (id: number) => {
    return get().proposals.find(p => p.id === id);
  },
  
  getApprovedProposals: () => {
    return get().proposals.filter(p => p.approvalStatus === 'approved');
  },
  
  getRejectedProposals: () => {
    return get().proposals.filter(p => p.approvalStatus === 'rejected');
  },
  
  getHistoryProposals: () => {
    return get().proposals.filter(
      p => p.approvalStatus === 'approved' || p.approvalStatus === 'rejected'
    );
  },
  
  getPendingProposals: () => {
    return get().proposals.filter(p => p.approvalStatus === 'pending');
  },
  
  // Actions
  fetchProposals: async (force = false) => {
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
}));
