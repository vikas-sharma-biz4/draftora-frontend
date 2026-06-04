/**
 * Zustand store for proposal wizard state
 *
 * Migrated from ProposalWizardContext (React Context) to Zustand to allow
 * selective subscriptions. Components using granular selector hooks
 * are no longer re-rendered when unrelated wizard state changes — only
 * direct subscribers are affected, eliminating cascade re-renders.
 *
 * ProposalWizardProvider in ProposalWizardContext.tsx is retained as a thin
 * hydration wrapper (localStorage read/write on mount). The context itself
 * is no longer the source of truth — this store is.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

import { DEFAULT_AI_MODEL } from "@/config/config";
import { DEFAULT_SELECTED_SECTIONS, PROPOSAL_WIZARD_STORAGE_KEY } from "@/constants";
import type { ProposalWizardData, WizardStep } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";
import { getSectionRecommendations } from "@/services/proposal.service";
import type { SectionRecommendation } from "@/services/proposal/templateParser.service";
import { SECTION_DISPLAY_NAMES } from "@/constants";

export const DEFAULT_PROPOSAL_DATA: ProposalWizardData = {
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
  selectedDocumentIds: [],
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
  prefetchedRecommendations: null as SectionRecommendation[] | null,
  recommendationsFetchStatus: "idle" as "idle" | "loading" | "success" | "error",
  recommendationsError: null as string | null,
};

interface ProposalWizardState {
  proposalData: ProposalWizardData;
  currentStep: WizardStep;
  isGenerating: boolean;
  generatedProposalId: number | null;
  currentProposalId: number | null;
  hydrated: boolean;
  editMode: boolean;
  maxStepReached: WizardStep;
  shouldStartBackgroundFetch: boolean;
  prefetchedRecommendations: SectionRecommendation[] | null;
  recommendationsFetchStatus: "idle" | "loading" | "success" | "error";
  recommendationsError: string | null;

  updateProposalData: (updates: Partial<ProposalWizardData>) => void;
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
  prefetchRecommendations: () => void;
  cancelRecommendationsFetch: () => void;
  invalidateRecommendationsCache: () => void;
  clearRecommendationsError: () => void;
}

type PersistedWizardState = Pick<
  ProposalWizardState,
  "proposalData" | "currentStep" | "currentProposalId" | "generatedProposalId" | "maxStepReached"
>;

export const useProposalWizardStore = create<ProposalWizardState>()(
  persist(
    (set) => ({
      ...INITIAL_WIZARD_STATE,

      updateProposalData: (updates: Partial<ProposalWizardData>): void => {
        set((state) => {
          const newProposalData = { ...state.proposalData, ...updates };
          logger.debug("[proposalWizardSlice] updateProposalData", { updates, newProposalData });
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

      // After reset, keep hydrated: true since the component is already mounted
      resetProposal: (): void => {
        set({ ...INITIAL_WIZARD_STATE, hydrated: true });
      },

      reset: (): void => {
        set(INITIAL_WIZARD_STATE);
      },

      prefetchRecommendations: async (): Promise<void> => {
        const state = useProposalWizardStore.getState();
        const { proposalData } = state;

        // Allow prefetch even without description/documents - the backend can handle empty context
        logger.debug(
          "[proposalWizardSlice] Prefetching recommendations | has_description=%s | has_documents=%s",
          !!proposalData.description,
          !!proposalData.selectedDocumentIds?.length
        );

        set({ recommendationsFetchStatus: "loading" });

        try {
          const existingSectionsWithRules = proposalData.selectedSections.map((key) => ({
            sectionKey: key,
            sectionName:
              SECTION_DISPLAY_NAMES[key] ||
              key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            include: "",
            exclude: "",
            purpose: "",
          }));

          const recs = await getSectionRecommendations({
            templateId: proposalData.templateId,
            existingSections: proposalData.selectedSections,
            existingSectionsWithRules,
            context: proposalData.description || "",
            userPrompt: null,
          });

          set({
            prefetchedRecommendations: recs,
            recommendationsFetchStatus: "success",
          });
          logger.info("[proposalWizardSlice] Recommendations prefetched successfully", {
            count: recs.length,
          });
        } catch (error) {
          logger.error("[proposalWizardSlice] Failed to prefetch recommendations", error);
          set({
            recommendationsFetchStatus: "error",
            recommendationsError:
              error instanceof Error ? error.message : "Failed to fetch recommendations",
          });
        }
      },

      cancelRecommendationsFetch: (): void => {
        // Implementation for canceling recommendations fetch
        set({ recommendationsFetchStatus: "idle" });
      },

      invalidateRecommendationsCache: (): void => {
        // Implementation for invalidating recommendations cache
        set({ prefetchedRecommendations: null, recommendationsFetchStatus: "idle" });
      },

      clearRecommendationsError: (): void => {
        // Implementation for clearing recommendations error
        set({ recommendationsError: null });
      },
    }),
    {
      name: PROPOSAL_WIZARD_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist wizard form data + navigation state; never ephemeral flags
      partialize: (state): PersistedWizardState => ({
        proposalData: {
          ...state.proposalData,
          files: [], // File objects cannot be serialized to JSON
        },
        currentStep: state.currentStep,
        currentProposalId: state.currentProposalId,
        generatedProposalId: state.generatedProposalId,
        maxStepReached: state.maxStepReached,
      }),
      // Deep-merge persisted proposalData with defaults so new required fields
      // introduced in future versions are always present after hydration.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedWizardState>;
        return {
          ...currentState,
          ...persisted,
          proposalData: {
            ...DEFAULT_PROPOSAL_DATA,
            ...(persisted.proposalData ?? {}),
            files: [],
          },
          hydrated: false, // set to true by onRehydrateStorage below
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hydrated = true;
        }
      },
    }
  )
);

// ─── Granular Selector Hooks ─────────────────────────────────────────────────────

/**
 * Selector hooks for fine-grained Zustand subscriptions.
 *
 * Components should use these hooks to subscribe only to the specific state
 * they need, avoiding unnecessary re-renders when unrelated state changes.
 */

/**
 * Selects the proposal title.
 */
export const useProposalTitle = () => useProposalWizardStore((state) => state.proposalData.title);

/**
 * Selects the client name.
 */
export const useClientName = () => useProposalWizardStore((state) => state.proposalData.clientName);

/**
 * Selects the client ID.
 */
export const useClientId = () => useProposalWizardStore((state) => state.proposalData.clientId);

/**
 * Selects the template type.
 */
export const useTemplateType = () =>
  useProposalWizardStore((state) => state.proposalData.templateType);

/**
 * Selects the template ID.
 */
export const useTemplateId = () => useProposalWizardStore((state) => state.proposalData.templateId);

/**
 * Selects the proposal description.
 */
export const useProposalDescription = () =>
  useProposalWizardStore((state) => state.proposalData.description);

/**
 * Selects the contextual instructions.
 */
export const useContextualInstructions = () =>
  useProposalWizardStore((state) => state.proposalData.contextualInstructions);

/**
 * Selects the selected sections array.
 */
export const useSelectedSections = () =>
  useProposalWizardStore((state) => state.proposalData.selectedSections);

/**
 * Selects the section display names object.
 */
export const useSectionDisplayNames = () =>
  useProposalWizardStore((state) => state.proposalData.sectionDisplayNames);

/**
 * Selects the tone preference.
 */
export const useTone = () => useProposalWizardStore((state) => state.proposalData.tone);

/**
 * Selects the length preference.
 */
export const useLengthPreference = () =>
  useProposalWizardStore((state) => state.proposalData.lengthPreference);

/**
 * Selects the language preference.
 */
export const useLanguage = () => useProposalWizardStore((state) => state.proposalData.language);

/**
 * Selects the AI model preference.
 */
export const useAiModel = () => useProposalWizardStore((state) => state.proposalData.aiModel);

/**
 * Selects the exact document name (for recreate mode).
 */
export const useExactDocumentName = () =>
  useProposalWizardStore((state) => state.proposalData.exactDocumentName);

/**
 * Selects the approval status.
 */
export const useApprovalStatus = () =>
  useProposalWizardStore((state) => state.proposalData.approvalStatus);

/**
 * Selects the original sections (for recreate mode).
 */
export const useOriginalSections = () =>
  useProposalWizardStore((state) => state.proposalData.originalSections);

/**
 * Selects the files metadata (for knowledge base).
 */
export const useFilesMeta = () => useProposalWizardStore((state) => state.proposalData.filesMeta);

/**
 * Selects the web references (for knowledge base).
 */
export const useWebReferences = () =>
  useProposalWizardStore((state) => state.proposalData.webReferences);

/**
 * Selects the selected document IDs (for knowledge base).
 */
export const useSelectedDocumentIds = () =>
  useProposalWizardStore((state) => state.proposalData.selectedDocumentIds);

/**
 * Selects the current wizard step.
 */
export const useCurrentStep = () => useProposalWizardStore((state) => state.currentStep);

/**
 * Selects the maximum step reached.
 */
export const useMaxStepReached = () => useProposalWizardStore((state) => state.maxStepReached);

/**
 * Selects the generation status.
 */
export const useIsGenerating = () => useProposalWizardStore((state) => state.isGenerating);

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
export const useEditMode = () => useProposalWizardStore((state) => state.editMode);

/**
 * Selects the hydration status.
 */
export const useHydrated = () => useProposalWizardStore((state) => state.hydrated);

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
  useProposalWizardStore(
    useShallow((state) => ({
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
    }))
  );
