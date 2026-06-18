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

import { create } from "zustand";
import type {
  DraftMetadata,
  SavedDraft,
  SaveDraftPayload,
  DraftStage,
} from "@/interfaces/draftInterfaces";
import * as draftApi from "@/services/draft.service";
import { setDraftTemplateMeta } from "@/utils/draftTemplateCache";
import { sortByUpdatedAtDesc } from "@/utils/sortUtils";
import { logger } from "@/utils/logger";

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

  // Computed
  isCacheValid: () => boolean;
  getDraftById: (id: string) => DraftMetadata | undefined;

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

  // Computed
  isCacheValid: () => {
    const { lastFetched, isInitialized } = get();
    if (!isInitialized || lastFetched === null) return false;
    return Date.now() - lastFetched < CACHE_TTL_MS;
  },

  getDraftById: (id: string) => {
    return get().drafts.find((d) => d.id === id);
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
      const drafts = sortByUpdatedAtDesc(await draftApi.listDrafts());
      set({
        drafts,
        isLoading: false,
        isInitialized: true,
        lastFetched: Date.now(),
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch drafts";
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
    set((state) => ({
      drafts: [draft, ...state.drafts],
      lastFetched: Date.now(),
    }));
  },

  updateDraft: (id: string, updates: Partial<DraftMetadata>) => {
    set((state) => ({
      drafts: state.drafts.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      lastFetched: Date.now(),
    }));
  },

  removeDraft: (id: string) => {
    set((state) => ({
      drafts: state.drafts.filter((d) => d.id !== id),
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

    // Persist template metadata for draft card display
    const proposalData = payload.wizardState?.proposalData as unknown as
      | Record<string, unknown>
      | undefined;
    if (proposalData) {
      const templateId = (proposalData.templateId as string | null | undefined) ?? null;
      const templateType = (proposalData.templateType as string | undefined) ?? "scratch";
      setDraftTemplateMeta(savedDraft.id, { templateId, templateType });
    }

    return savedDraft;
  },

  updateDraftApi: async (draftId: string, payload: Partial<SaveDraftPayload>) => {
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

    // Keep template cache in sync if payload includes wizard state
    const proposalData = payload.wizardState?.proposalData as unknown as
      | Record<string, unknown>
      | undefined;
    if (proposalData) {
      const templateId = (proposalData.templateId as string | null | undefined) ?? null;
      const templateType = (proposalData.templateType as string | undefined) ?? "scratch";
      setDraftTemplateMeta(draftId, { templateId, templateType });
    }

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
      logger.error("[draftSlice] deleteDraft failed:", error);
      throw error;
    }
  },

  deleteAllDrafts: async () => {
    try {
      await draftApi.deleteAllDrafts();

      // Remove all from store
      get().removeAllDrafts();
    } catch (error) {
      logger.error("[draftSlice] deleteAllDrafts failed:", error);
      throw error;
    }
  },
}));
