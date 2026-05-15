/**
 * Zustand store for draft list management with smart caching
 *
 * Manages draft list state:
 * - Centralized draft list across the application
 * - Smart caching with configurable TTL
 * - Optimistic updates for mutations
 * - Automatic cache invalidation
 *
 * Note: Draft session state (currentDraftId, draftStage, completedSteps)
 * is managed by useDraftSessionStore (src/store/features/drafts/draftSessionSlice.ts)
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { DraftMetadata, SavedDraft, SaveDraftPayload, DraftStage } from '@/interfaces/draftInterfaces';
import * as draftApi from '@/services/draft.service';
import { logger } from '@/utils/logger';

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes (drafts change frequently)

export const INITIAL_DRAFT_STATE = {
  drafts: [] as DraftMetadata[],
  isLoading: false,
  isInitialized: false,
  lastFetched: null as number | null,
  error: null as string | null,
};

interface DraftState {
  // Draft list state
  drafts: DraftMetadata[];
  isLoading: boolean;
  isInitialized: boolean;
  lastFetched: number | null;
  error: string | null;

  // Draft list actions
  fetchDrafts: (force?: boolean) => Promise<void>;
  setDrafts: (drafts: DraftMetadata[]) => void;
  addDraft: (draft: DraftMetadata) => void;
  updateDraft: (id: string, updates: Partial<DraftMetadata>) => void;
  removeDraft: (id: string) => void;
  removeAllDrafts: () => void;
  invalidateCache: () => void;

  // Mutation wrappers
  saveDraft: (payload: SaveDraftPayload) => Promise<SavedDraft>;
  updateDraftApi: (draftId: string, payload: Partial<SaveDraftPayload>) => Promise<SavedDraft>;
  getDraft: (draftId: string) => Promise<SavedDraft>;
  deleteDraft: (draftId: string) => Promise<void>;
  deleteAllDrafts: () => Promise<void>;
  reset: () => void;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  // Draft list state
  drafts: [],
  isLoading: false,
  isInitialized: false,
  lastFetched: null,
  error: null,

  // Actions
  fetchDrafts: async (force = false) => {
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
      const drafts = await draftApi.listDrafts();
      set({
        drafts,
        isLoading: false,
        isInitialized: true,
        lastFetched: Date.now(),
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch drafts';
      // Backend unavailable — gracefully degrade to empty state for dev/demo
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        set({
          drafts: [],
          isLoading: false,
          isInitialized: true,
          lastFetched: Date.now(),
          error: null,
        });
        return;
      }
      set({
        isLoading: false,
        error: errorMessage,
      });
      // Don't re-throw - silently fail and let components handle the error state
      console.warn('[draftSlice] Failed to fetch drafts:', errorMessage);
    }
  },

  setDrafts: (drafts: DraftMetadata[]) => {
    set({
      drafts,
      isInitialized: true,
      lastFetched: Date.now(),
    });
  },

  addDraft: (draft: DraftMetadata) => {
    set(state => ({
      drafts: [draft, ...state.drafts],
      lastFetched: Date.now(),
    }));
  },

  updateDraft: (id: string, updates: Partial<DraftMetadata>) => {
    set(state => ({
      drafts: state.drafts.map(d =>
        d.id === id ? { ...d, ...updates } : d
      ),
      lastFetched: Date.now(),
    }));
  },

  removeDraft: (id: string) => {
    set(state => ({
      drafts: state.drafts.filter(d => d.id !== id),
      lastFetched: Date.now(),
    }));
  },

  removeAllDrafts: () => {
    set({
      drafts: [],
      lastFetched: Date.now(),
    });
  },

  invalidateCache: () => {
    set({
      lastFetched: null,
      isInitialized: false,
    });
  },

  reset: () => set(INITIAL_DRAFT_STATE),

  // Mutation wrappers with optimistic updates
  saveDraft: async (payload: SaveDraftPayload) => {
    logger.info('[draftSlice] saveDraft called:', { title: payload.title });
    const savedDraft = await draftApi.saveDraft(payload);
    logger.info('[draftSlice] saveDraft received backend ID:', savedDraft.id);

    // Add to store as metadata
    const draftMetadata: DraftMetadata = {
      id: savedDraft.id,
      proposalId: savedDraft.proposalId,
      title: savedDraft.title,
      clientName: savedDraft.clientName,
      status: savedDraft.status,
      lastLocation: savedDraft.lastLocation,
      stage: savedDraft.stage,
      updatedAt: savedDraft.updatedAt,
    };

    get().addDraft(draftMetadata);

    return savedDraft;
  },

  updateDraftApi: async (draftId: string, payload: Partial<SaveDraftPayload>) => {
    logger.info('[draftSlice] updateDraftApi called:', { draftId });
    const updatedDraft = await draftApi.updateDraft(draftId, payload);

    // Update in store
    const draftMetadata: Partial<DraftMetadata> = {
      title: updatedDraft.title,
      clientName: updatedDraft.clientName,
      status: updatedDraft.status,
      lastLocation: updatedDraft.lastLocation,
      stage: updatedDraft.stage,
      updatedAt: updatedDraft.updatedAt,
    };

    get().updateDraft(draftId, draftMetadata);

    return updatedDraft;
  },

  getDraft: async (draftId: string) => {
    return draftApi.getDraft(draftId);
  },

  deleteDraft: async (draftId: string) => {
    try {
      await draftApi.deleteDraft(draftId);

      // Remove from store
      get().removeDraft(draftId);
    } catch (error) {
      logger.error('[draftSlice] deleteDraft failed:', error);
      throw error;
    }
  },

  deleteAllDrafts: async () => {
    try {
      await draftApi.deleteAllDrafts();

      // Remove all from store
      get().removeAllDrafts();
    } catch (error) {
      logger.error('[draftSlice] deleteAllDrafts failed:', error);
      throw error;
    }
  },
}));

// ─── Standalone Selectors ─────────────────────────────────────────────────────

/**
 * Pure selectors for derived state computations.
 * These are framework-agnostic and can be used with Zustand's selector API.
 */

/**
 * Selects whether the cache is still valid based on TTL.
 */
export const selectIsCacheValid = (state: DraftState): boolean => {
  if (!state.isInitialized || state.lastFetched === null) return false;
  return Date.now() - state.lastFetched < CACHE_TTL_MS;
};

/**
 * Selects a draft by its ID.
 */
export const selectDraftById = (id: string) => (state: DraftState): DraftMetadata | undefined => {
  return state.drafts.find(d => d.id === id);
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
export const useIsCacheValid = () => useDraftStore(selectIsCacheValid);

/**
 * Selects a draft by its ID.
 */
export const useDraftById = (id: string) => useDraftStore(selectDraftById(id));

/**
 * Selects all drafts
 */
export const useDrafts = () => useDraftStore((state) => state.drafts);

/**
 * Selects the loading state
 */
export const useDraftsLoading = () => useDraftStore((state) => state.isLoading);

/**
 * Selects the initialization state
 */
export const useDraftsInitialized = () => useDraftStore((state) => state.isInitialized);

/**
 * Selects the error state
 */
export const useDraftsError = () => useDraftStore((state) => state.error);

/**
 * Selects the last fetched timestamp
 */
export const useDraftsLastFetched = () => useDraftStore((state) => state.lastFetched);

/**
 * Selects all draft actions (stable reference)
 */
export const useDraftActions = () =>
  useDraftStore(
    useShallow((state) => ({
      fetchDrafts: state.fetchDrafts,
      setDrafts: state.setDrafts,
      addDraft: state.addDraft,
      updateDraft: state.updateDraft,
      removeDraft: state.removeDraft,
      removeAllDrafts: state.removeAllDrafts,
      deleteAllDrafts: state.deleteAllDrafts,
      reset: state.reset,
    }))
  );
