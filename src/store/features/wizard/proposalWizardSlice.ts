/**
 * Zustand store for proposal wizard state
 *
 * Migrated from ProposalWizardContext (React Context) to Zustand to allow
 * selective subscriptions. Components not calling useProposalWizard() are
 * no longer re-rendered when wizard state changes — only direct subscribers
 * are affected, eliminating the cascade re-render caused by React Context.
 *
 * ProposalWizardProvider in ProposalWizardContext.tsx is retained as a thin
 * hydration wrapper (localStorage read/write on mount). The context itself
 * is no longer the source of truth — this store is.
 */

import { create } from "zustand";

import { DEFAULT_AI_MODEL } from "@/config/config";
import { DEFAULT_SELECTED_SECTIONS, PROPOSAL_WIZARD_STORAGE_KEY } from "@/constants";
import type { ProposalData, WizardStep } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";
import type { SectionRecommendation } from "@/services/proposal.service";
import { getSectionRecommendations } from "@/services/proposal.service";
import { SECTION_DISPLAY_NAMES } from "@/constants";

export const DEFAULT_PROPOSAL_DATA: ProposalData = {
  title: "",
  clientName: "",
  clientId: undefined,
  description: "",
  tone: "professional",
  lengthPreference: "balanced",
  language: "English - US",
  aiModel: DEFAULT_AI_MODEL,
  selectedSections: [...DEFAULT_SELECTED_SECTIONS],
  sectionDisplayNames: {},
  customSections: [],
  contextualInstructions: "",
  webReferences: [],
  files: [],
  filesMeta: [],
  templateId: null,
  templateType: "scratch",
};

export const INITIAL_WIZARD_STATE = {
  proposalData: DEFAULT_PROPOSAL_DATA,
  currentStep: 1 as WizardStep,
  isGenerating: false,
  generatedProposalId: null as number | null,
  currentProposalId: null as number | null,
  hydrated: false,
  editMode: false,
  maxStepReached: 1 as WizardStep,
  shouldStartBackgroundFetch: false,
  // Section recommendations prefetch state
  prefetchedRecommendations: null as SectionRecommendation[] | null,
  recommendationsFetchPromise: null as Promise<SectionRecommendation[]> | null,
  recommendationsAbortController: null as AbortController | null,
  recommendationsFetchStatus: 'idle' as 'idle' | 'pending' | 'success' | 'error',
  recommendationsCacheKey: null as string | null,
  recommendationsError: null as Error | null,
};

interface ProposalWizardState {
  proposalData: ProposalData;
  currentStep: WizardStep;
  isGenerating: boolean;
  generatedProposalId: number | null;
  currentProposalId: number | null;
  hydrated: boolean;
  editMode: boolean;
  maxStepReached: WizardStep;
  shouldStartBackgroundFetch: boolean;
  // Section recommendations prefetch state
  prefetchedRecommendations: SectionRecommendation[] | null;
  recommendationsFetchPromise: Promise<SectionRecommendation[]> | null;
  recommendationsAbortController: AbortController | null;
  recommendationsFetchStatus: 'idle' | 'pending' | 'success' | 'error';
  recommendationsCacheKey: string | null;
  recommendationsError: Error | null;

  updateProposalData: (updates: Partial<ProposalData>) => void;
  setCurrentStep: (step: WizardStep) => void;
  setIsGenerating: (val: boolean) => void;
  setGeneratedProposalId: (id: number | null) => void;
  setCurrentProposalId: (id: number | null) => void;
  setHydrated: (val: boolean) => void;
  setEditMode: (val: boolean) => void;
  setMaxStepReached: (step: WizardStep) => void;
  setShouldStartBackgroundFetch: (val: boolean) => void;
  resetProposal: () => void;
  reset: () => void;
  // Section recommendations prefetch actions
  prefetchRecommendations: (params: {
    templateId: string | null;
    existingSections: string[];
    context: string;
    documentContext: string;
  }) => Promise<SectionRecommendation[]>;
  cancelRecommendationsFetch: () => void;
  invalidateRecommendationsCache: () => void;
  clearRecommendationsError: () => void;
}

export const useProposalWizardStore = create<ProposalWizardState>((set) => ({
  ...INITIAL_WIZARD_STATE,

  updateProposalData: (updates: Partial<ProposalData>): void => {
    set((state) => {
      const newProposalData = { ...state.proposalData, ...updates };
      logger.debug('[proposalWizardSlice] updateProposalData', { updates, newProposalData });
      return { proposalData: newProposalData };
    });
  },

  setCurrentStep: (step: WizardStep): void => {
    set({ currentStep: step });
  },

  setIsGenerating: (val: boolean): void => {
    set({ isGenerating: val });
  },

  setGeneratedProposalId: (id: number | null): void => {
    set({ generatedProposalId: id });
  },

  setCurrentProposalId: (id: number | null): void => {
    set({ currentProposalId: id });
  },

  setHydrated: (val: boolean): void => {
    set({ hydrated: val });
  },

  setEditMode: (val: boolean): void => {
    set({ editMode: val });
  },

  setMaxStepReached: (step: WizardStep): void => {
    set({ maxStepReached: step });
  },

  setShouldStartBackgroundFetch: (val: boolean): void => {
    set({ shouldStartBackgroundFetch: val });
  },

  resetProposal: (): void => {
    set(INITIAL_WIZARD_STATE);
    try {
      localStorage.removeItem(PROPOSAL_WIZARD_STORAGE_KEY);
    } catch (e) {
      logger.warn("[proposalWizardSlice] Failed to clear wizard storage", e);
    }
  },

  reset: (): void => {
    set(INITIAL_WIZARD_STATE);
  },

  // ─── Section Recommendations Prefetch Actions ─────────────────────────────────

  /**
   * Prefetch section recommendations in the background.
   * Implements request deduplication - if a fetch is already in progress,
   * returns the existing promise instead of firing a new request.
   * 
   * @param params - Parameters for the recommendations API call
   * @returns Promise that resolves with the recommendations
   */
  prefetchRecommendations: async (params: {
    templateId: string | null;
    existingSections: string[];
    context: string;
    documentContext: string;
  }): Promise<SectionRecommendation[]> => {
    const state = useProposalWizardStore.getState();
    
    // Generate cache key based on input parameters
    const cacheKey = JSON.stringify({
      templateId: params.templateId,
      existingSections: params.existingSections.sort(),
      context: params.context,
      documentContext: params.documentContext,
    });

    // Check if cache is still valid (same cache key)
    if (state.recommendationsCacheKey === cacheKey && state.recommendationsFetchStatus === 'success' && state.prefetchedRecommendations) {
      logger.debug('[proposalWizardSlice] Using cached recommendations', { cacheKey });
      return state.prefetchedRecommendations;
    }

    // Check if a fetch is already in progress for this cache key
    if (state.recommendationsFetchStatus === 'pending' && state.recommendationsFetchPromise && state.recommendationsCacheKey === cacheKey) {
      logger.debug('[proposalWizardSlice] Using in-progress fetch promise', { cacheKey });
      return state.recommendationsFetchPromise;
    }

    // Cancel any existing in-flight request with different cache key
    if (state.recommendationsAbortController && state.recommendationsCacheKey !== cacheKey) {
      logger.debug('[proposalWizardSlice] Canceling previous fetch with different cache key');
      state.recommendationsAbortController.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    
    set({
      recommendationsFetchStatus: 'pending',
      recommendationsAbortController: abortController,
      recommendationsCacheKey: cacheKey,
      recommendationsError: null,
    });

    try {
      const fullContext = [params.documentContext, params.context].filter(Boolean).join("\n\n");

      const existingSectionsWithRules = params.existingSections.map((key) => ({
        sectionKey: key,
        sectionName: SECTION_DISPLAY_NAMES[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        include: "",
        exclude: "",
        purpose: "",
      }));

      const fetchPromise = getSectionRecommendations({
        templateId: params.templateId,
        existingSections: params.existingSections,
        existingSectionsWithRules,
        context: fullContext,
        userPrompt: null,
      });

      // Store the promise for deduplication
      set({ recommendationsFetchPromise: fetchPromise });

      const recommendations = await fetchPromise;

      // Check if request was cancelled
      if (abortController.signal.aborted) {
        logger.debug('[proposalWizardSlice] Recommendations fetch was aborted');
        throw new Error('Request was cancelled');
      }

      set({
        prefetchedRecommendations: recommendations,
        recommendationsFetchStatus: 'success',
        recommendationsAbortController: null,
      });

      logger.debug('[proposalWizardSlice] Recommendations prefetched successfully', { count: recommendations.length });
      return recommendations;
    } catch (error) {
      // Don't update state if the error was due to cancellation
      if (abortController.signal.aborted) {
        logger.debug('[proposalWizardSlice] Recommendations fetch aborted, not updating error state');
        throw error;
      }

      const errorObj = error instanceof Error ? error : new Error('Failed to fetch recommendations');
      set({
        recommendationsFetchStatus: 'error',
        recommendationsError: errorObj,
        recommendationsAbortController: null,
        recommendationsFetchPromise: null,
      });
      
      logger.error('[proposalWizardSlice] Failed to prefetch recommendations', error);
      throw errorObj;
    }
  },

  /**
   * Cancel any in-flight recommendations fetch.
   */
  cancelRecommendationsFetch: (): void => {
    const state = useProposalWizardStore.getState();
    if (state.recommendationsAbortController) {
      logger.debug('[proposalWizardSlice] Canceling recommendations fetch');
      state.recommendationsAbortController.abort();
      set({
        recommendationsAbortController: null,
        recommendationsFetchStatus: 'idle',
        recommendationsFetchPromise: null,
      });
    }
  },

  /**
   * Invalidate the recommendations cache.
   * Call this when template, context, or sections change.
   */
  invalidateRecommendationsCache: (): void => {
    const state = useProposalWizardStore.getState();
    if (state.recommendationsAbortController) {
      state.recommendationsAbortController.abort();
    }
    set({
      prefetchedRecommendations: null,
      recommendationsFetchPromise: null,
      recommendationsAbortController: null,
      recommendationsFetchStatus: 'idle',
      recommendationsCacheKey: null,
      recommendationsError: null,
    });
    logger.debug('[proposalWizardSlice] Recommendations cache invalidated');
  },

  /**
   * Clear the recommendations error state.
   */
  clearRecommendationsError: (): void => {
    set({ recommendationsError: null });
  },
}));

// ─── Granular Selector Hooks ─────────────────────────────────────────────────────

/**
 * Selector hooks for fine-grained Zustand subscriptions.
 *
 * Components should use these hooks to subscribe only to the specific state
 * they need, avoiding unnecessary re-renders when unrelated state changes.
 */

/**
 * Selects the entire proposalData object.
 * Use this when you need multiple fields from proposalData.
 */
export const useProposalData = () =>
  useProposalWizardStore((state) => state.proposalData);

/**
 * Selects the proposal title.
 */
export const useProposalTitle = () =>
  useProposalWizardStore((state) => state.proposalData.title);

/**
 * Selects the client name.
 */
export const useClientName = () =>
  useProposalWizardStore((state) => state.proposalData.clientName);

/**
 * Selects the client ID.
 */
export const useClientId = () =>
  useProposalWizardStore((state) => state.proposalData.clientId);

/**
 * Selects the current wizard step.
 */
export const useCurrentStep = () =>
  useProposalWizardStore((state) => state.currentStep);

/**
 * Selects the maximum step reached.
 */
export const useMaxStepReached = () =>
  useProposalWizardStore((state) => state.maxStepReached);

/**
 * Selects the generation status.
 */
export const useIsGenerating = () =>
  useProposalWizardStore((state) => state.isGenerating);

/**
 * Selects the generated proposal ID.
 */
export const useGeneratedProposalId = () =>
  useProposalWizardStore((state) => state.generatedProposalId);

/**
 * Selects the current proposal ID.
 */
export const useCurrentProposalId = () =>
  useProposalWizardStore((state) => state.currentProposalId);

/**
 * Selects the edit mode flag.
 */
export const useEditMode = () =>
  useProposalWizardStore((state) => state.editMode);

/**
 * Selects the hydration status.
 */
export const useHydrated = () =>
  useProposalWizardStore((state) => state.hydrated);

/**
 * Selects the background fetch flag.
 */
export const useShouldStartBackgroundFetch = () =>
  useProposalWizardStore((state) => state.shouldStartBackgroundFetch);

/**
 * Selects prefetched recommendations.
 */
export const usePrefetchedRecommendations = () =>
  useProposalWizardStore((state) => state.prefetchedRecommendations);

/**
 * Selects recommendations fetch status.
 */
export const useRecommendationsFetchStatus = () =>
  useProposalWizardStore((state) => state.recommendationsFetchStatus);

/**
 * Selects recommendations error.
 */
export const useRecommendationsError = () =>
  useProposalWizardStore((state) => state.recommendationsError);

/**
 * Selects all wizard actions (stable reference).
 * Use this when you need multiple actions without subscribing to state changes.
 */
export const useWizardActions = () =>
  useProposalWizardStore((state) => ({
    updateProposalData: state.updateProposalData,
    setCurrentStep: state.setCurrentStep,
    setIsGenerating: state.setIsGenerating,
    setGeneratedProposalId: state.setGeneratedProposalId,
    setCurrentProposalId: state.setCurrentProposalId,
    setHydrated: state.setHydrated,
    setEditMode: state.setEditMode,
    setMaxStepReached: state.setMaxStepReached,
    setShouldStartBackgroundFetch: state.setShouldStartBackgroundFetch,
    resetProposal: state.resetProposal,
    reset: state.reset,
    prefetchRecommendations: state.prefetchRecommendations,
    cancelRecommendationsFetch: state.cancelRecommendationsFetch,
    invalidateRecommendationsCache: state.invalidateRecommendationsCache,
    clearRecommendationsError: state.clearRecommendationsError,
  }));
