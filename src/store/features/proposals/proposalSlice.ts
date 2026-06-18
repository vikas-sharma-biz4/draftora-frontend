/**
 * Zustand store for proposal state management with smart caching
 *
 * Shared between Dashboard and History pages to eliminate duplicate API calls
 *
 * Features:
 * - Centralized proposal state
 * - Smart caching with configurable TTL — allProposals and historyProposals have
 *   independent lastFetched timestamps so Dashboard and History never overwrite each other
 * - Computed selectors for filtering
 * - Automatic cache invalidation
 * - Paginated fetching with infinite-scroll support (fetchMoreProposals)
 */

import { create } from "zustand";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";
import * as proposalApi from "@/services/proposal";
import { sortByCreatedAtDesc } from "@/utils/sortUtils";

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const DEFAULT_PAGE_SIZE = 20;

export const INITIAL_PROPOSAL_STATE = {
  // All proposals — Dashboard
  proposals: [] as ProposalListItem[],
  isLoading: false,
  isLoadingMore: false,
  isInitialized: false,
  lastFetched: null as number | null,
  error: null as string | null,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  hasMore: false,

  // History proposals (approved/rejected) — History page
  historyProposals: [] as ProposalListItem[],
  historyLastFetched: null as number | null,
  historyInitialized: false,

  // Version draft proposals — pending proposals branched from History rows.
  // Kept separate so the DraftsPage can optimistically add/remove them without
  // triggering a full proposals refetch after each branch operation.
  versionDrafts: [] as ProposalListItem[],
  versionDraftsLastFetched: null as number | null,
};

interface ProposalState {
  // All proposals state (Dashboard)
  proposals: ProposalListItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isInitialized: boolean;
  lastFetched: number | null;
  error: string | null;
  page: number;
  pageSize: number;
  hasMore: boolean;

  // History proposals state (History page)
  historyProposals: ProposalListItem[];
  historyLastFetched: number | null;
  historyInitialized: boolean;

  // Version draft proposals state (Drafts page — version-draft section)
  versionDrafts: ProposalListItem[];
  versionDraftsLastFetched: number | null;

  // Computed selectors
  isCacheValid: () => boolean;
  isHistoryCacheValid: () => boolean;
  getProposalById: (id: number) => ProposalListItem | undefined;
  getApprovedProposals: () => ProposalListItem[];
  getRejectedProposals: () => ProposalListItem[];
  getHistoryProposals: () => ProposalListItem[];
  getPendingProposals: () => ProposalListItem[];

  // Actions
  fetchProposals: (force?: boolean) => Promise<void>;
  fetchMoreProposals: () => Promise<void>;
  fetchProposalHistory: (force?: boolean) => Promise<void>;
  setProposals: (proposals: ProposalListItem[]) => void;
  addProposal: (proposal: ProposalListItem) => void;
  updateProposal: (id: number, updates: Partial<ProposalListItem>) => void;
  removeProposal: (id: number) => void;
  invalidateCache: () => void;
  reset: () => void;

  // Version-draft actions — operate on the versionDrafts list only
  addVersionDraft: (draft: ProposalListItem) => void;
  removeVersionDraft: (id: number) => void;
  fetchVersionDrafts: (force?: boolean) => Promise<void>;
}

export const useProposalStore = create<ProposalState>((set, get) => ({
  // Initial state
  ...INITIAL_PROPOSAL_STATE,

  // --- All-proposals cache validator (Dashboard) ---
  isCacheValid: () => {
    const { lastFetched, isInitialized } = get();
    if (!isInitialized || lastFetched === null) return false;
    return Date.now() - lastFetched < CACHE_TTL_MS;
  },

  // --- History-proposals cache validator (History page) ---
  isHistoryCacheValid: () => {
    const { historyLastFetched, historyInitialized } = get();
    if (!historyInitialized || historyLastFetched === null) return false;
    return Date.now() - historyLastFetched < CACHE_TTL_MS;
  },

  getProposalById: (id: number) => {
    return get().proposals.find((p) => p.id === id);
  },

  // History selectors — all filter from historyProposals so Dashboard's
  // all-proposals array is never contaminated by history fetches.
  getApprovedProposals: () => {
    return get().historyProposals.filter((p) => p.approvalStatus === "approved");
  },

  getRejectedProposals: () => {
    return get().historyProposals.filter((p) => p.approvalStatus === "rejected");
  },

  getHistoryProposals: () => {
    return get().historyProposals;
  },

  // Pending proposals come from the all-proposals list
  getPendingProposals: () => {
    return get().proposals.filter((p) => p.approvalStatus === "pending");
  },

  // Actions
  fetchProposals: async (force = false) => {
    const { isCacheValid, isLoading } = get();

    if (!force && isCacheValid()) {
      return;
    }

    if (isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const items = await proposalApi.listProposals({ page: 1, limit: DEFAULT_PAGE_SIZE });

      const sorted = sortByCreatedAtDesc(items);

      set({
        proposals: sorted,
        isLoading: false,
        isInitialized: true,
        lastFetched: Date.now(),
        error: null,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        hasMore: items.length === DEFAULT_PAGE_SIZE,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch proposals";
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  fetchMoreProposals: async () => {
    const { isLoading, isLoadingMore, hasMore, page, pageSize } = get();

    if (!hasMore || isLoading || isLoadingMore) {
      return;
    }

    const nextPage = page + 1;
    set({ isLoadingMore: true, error: null });

    try {
      const items = await proposalApi.listProposals({ page: nextPage, limit: pageSize });

      const sorted = sortByCreatedAtDesc(items);

      set((state) => ({
        proposals: [...state.proposals, ...sorted],
        isLoadingMore: false,
        lastFetched: Date.now(),
        page: nextPage,
        hasMore: items.length === pageSize,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load more proposals";
      set({
        isLoadingMore: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  // Writes to historyProposals — never touches the all-proposals array so
  // Dashboard and History maintain fully independent cached state.
  fetchProposalHistory: async (force = false) => {
    const { isHistoryCacheValid, isLoading } = get();

    if (!force && isHistoryCacheValid()) {
      return;
    }

    if (isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await proposalApi.listProposalHistory(1, 100);

      const sorted = sortByCreatedAtDesc(response.items);

      set({
        historyProposals: sorted,
        isLoading: false,
        historyInitialized: true,
        historyLastFetched: Date.now(),
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch proposal history";
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
    set((state) => ({
      proposals: [proposal, ...state.proposals],
      lastFetched: Date.now(),
    }));
  },

  updateProposal: (id: number, updates: Partial<ProposalListItem>) => {
    set((state) => ({
      proposals: state.proposals.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      lastFetched: Date.now(),
    }));
  },

  removeProposal: (id: number) => {
    set((state) => ({
      proposals: state.proposals.filter((p) => p.id !== id),
      lastFetched: Date.now(),
    }));
  },

  // Invalidates both caches so the next fetch re-fetches from the API
  invalidateCache: () => {
    set({
      lastFetched: null,
      historyLastFetched: null,
      versionDraftsLastFetched: null,
    });
  },

  // --- Version-draft actions ---

  // Prepend a newly-created version draft so it appears immediately in the
  // DraftsPage without waiting for a full proposals refetch.
  addVersionDraft: (draft: ProposalListItem) => {
    set((state) => ({
      versionDrafts: [draft, ...state.versionDrafts],
      versionDraftsLastFetched: Date.now(),
    }));
  },

  // Remove a version draft by id (called after successful soft-delete).
  removeVersionDraft: (id: number) => {
    set((state) => ({
      versionDrafts: state.versionDrafts.filter((d) => d.id !== id),
    }));
  },

  // Fetch (or serve cached) version drafts — i.e. pending proposals that have
  // a parent_proposal_id.  Falls back to filtering the main proposals list when
  // the proposals cache is warm so we avoid a second API round-trip.
  fetchVersionDrafts: async (force = false) => {
    const { versionDraftsLastFetched, proposals, isInitialized, lastFetched } = get();
    const isCacheFresh =
      versionDraftsLastFetched !== null && Date.now() - versionDraftsLastFetched < CACHE_TTL_MS;

    if (!force && isCacheFresh) return;

    // If the main proposals list is already populated AND its cache is still valid,
    // derive version drafts from it in-memory instead of making an additional API call.
    // Guard on lastFetched !== null: when invalidateCache() was called (lastFetched = null)
    // the proposals array is stale and must not overwrite an optimistic addVersionDraft().
    if (isInitialized && proposals.length > 0 && lastFetched !== null) {
      const drafts = proposals.filter(
        (p) => p.approvalStatus === "pending" && p.parentProposalId != null
      );
      set({ versionDrafts: drafts, versionDraftsLastFetched: Date.now() });
      return;
    }

    // Otherwise fetch the first page of pending proposals and filter.
    try {
      const items = await proposalApi.listProposals({ page: 1, limit: 100 });
      const drafts = items.filter(
        (p) => p.approvalStatus === "pending" && p.parentProposalId != null
      );
      set({ versionDrafts: sortByCreatedAtDesc(drafts), versionDraftsLastFetched: Date.now() });
    } catch {
      // Non-fatal: DraftsPage can still render without version drafts
    }
  },

  reset: () => set(INITIAL_PROPOSAL_STATE),
}));
