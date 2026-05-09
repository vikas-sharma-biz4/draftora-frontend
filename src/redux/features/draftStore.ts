/**
 * Zustand store for draft state management with smart caching
 * 
 * Manages draft lifecycle:
 * - Centralized draft state across the application
 * - Smart caching with configurable TTL
 * - Optimistic updates for mutations
 * - Automatic cache invalidation
 */

import { create } from 'zustand';
import type { DraftMetadata, SavedDraft, SaveDraftPayload } from '@/interfaces/draftInterfaces';
import * as draftApi from '@/services/draftApi';

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes (drafts change frequently)

interface DraftState {
  // State
  drafts: DraftMetadata[];
  isLoading: boolean;
  isInitialized: boolean;
  lastFetched: number | null;
  error: string | null;
  
  // Computed
  isCacheValid: () => boolean;
  getDraftById: (id: string) => DraftMetadata | undefined;
  
  // Actions
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
}

export const useDraftStore = create<DraftState>((set, get) => ({
  // Initial state
  drafts: [],
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
  
  getDraftById: (id: string) => {
    return get().drafts.find(d => d.id === id);
  },
  
  // Actions
  fetchDrafts: async (force = false) => {
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
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
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
  
  // Mutation wrappers with optimistic updates
  saveDraft: async (payload: SaveDraftPayload) => {
    try {
      const savedDraft = await draftApi.saveDraft(payload);
      
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
    } catch (error) {
      throw error;
    }
  },
  
  updateDraftApi: async (draftId: string, payload: Partial<SaveDraftPayload>) => {
    try {
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
    } catch (error) {
      throw error;
    }
  },
  
  getDraft: async (draftId: string) => {
    try {
      const draft = await draftApi.getDraft(draftId);
      return draft;
    } catch (error) {
      throw error;
    }
  },
  
  deleteDraft: async (draftId: string) => {
    try {
      await draftApi.deleteDraft(draftId);

      // Remove from store
      get().removeDraft(draftId);
    } catch (error) {
      throw error;
    }
  },

  deleteAllDrafts: async () => {
    try {
      await draftApi.deleteAllDrafts();

      // Remove all from store
      get().removeAllDrafts();
    } catch (error) {
      throw error;
    }
  },
}));
