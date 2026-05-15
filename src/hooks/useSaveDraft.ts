"use client";

import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/utils/toast";
import { MESSAGES } from "@/constants/messages";
import { logger } from "@/utils/logger";

import {
  useProposalData,
  useCurrentStep,
  useMaxStepReached,
  useCurrentProposalId,
  useWizardActions,
  useFilesMeta,
  useSelectedDocumentIds,
  useWebReferences,
  useSectionDisplayNames,
  useSelectedSections,
  useProposalTitle,
  useClientName,
  useClientId,
  useProposalDescription,
  useTone,
  useLengthPreference,
  useLanguage,
  useAiModel,
  useTemplateId,
  useTemplateType,
} from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { updateDraft as updateDraftApi, getDraftByProposalId, getDraft } from "@/services/draft.service";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import type { DraftLocation, DraftUIState } from "@/interfaces/draftInterfaces";

const DRAFT_SAVE_LOCK_KEY = "draft_save_lock";

/**
 * Returns a `saveDraft` function that persists the current wizard state to
 * the backend database, resets the wizard, and navigates back to the root.
 */
export function useSaveDraft(): () => Promise<void> {
  // Use granular selectors to get current values (same as auto-save)
  const title = useProposalTitle();
  const clientName = useClientName();
  const clientId = useClientId();
  const description = useProposalDescription();
  const selectedSections = useSelectedSections();
  const sectionDisplayNames = useSectionDisplayNames();
  const tone = useTone();
  const lengthPreference = useLengthPreference();
  const language = useLanguage();
  const aiModel = useAiModel();
  const templateId = useTemplateId();
  const templateType = useTemplateType();
  const filesMeta = useFilesMeta();
  const selectedDocumentIds = useSelectedDocumentIds();
  const webReferences = useWebReferences();

  const currentStep = useCurrentStep();
  const maxStepReached = useMaxStepReached();
  const currentProposalId = useCurrentProposalId();
  const { resetProposal } = useWizardActions();
  const completedSteps = useDraftSessionStore(state => state.completedSteps);
  const router = useRouter();
  const pathname = usePathname();
  const currentDraftId = useDraftSessionStore(state => state.currentDraftId);
  const draftStage = useDraftSessionStore(state => state.draftStage);
  const setCurrentDraftId = useDraftSessionStore(state => state.setCurrentDraftId);
  const saveDraftToStore = useDraftStore(state => state.saveDraft);
  const updateDraftInStore = useDraftStore(state => state.updateDraftApi);

  return async function saveDraft(): Promise<void> {
    // Use localStorage-based lock to prevent concurrent saves across page navigations
    const lockValue = localStorage.getItem(DRAFT_SAVE_LOCK_KEY);
    if (lockValue === 'locked') {
      logger.debug('[useSaveDraft] Save already locked, skipping');
      return;
    }

    const hasData = title.trim() !== "" || clientName.trim() !== "";

    if (!hasData) {
      toast.error("Nothing to save — add a title or client name first.");
      return;
    }

    if (clientName.trim() === "") {
      toast.error("Please enter a client name before saving the draft.");
      return;
    }

    // Set localStorage lock immediately
    localStorage.setItem(DRAFT_SAVE_LOCK_KEY, 'locked');

    try {
      // Determine lastLocation based on current pathname
      const lastLocation: DraftLocation = (() => {
        if (pathname === "/parameters") return "wizard_parameters";
        if (pathname === "/review") return "wizard_review";
        if (pathname.startsWith("/proposal/")) return "web_view";
        return "wizard_parameters";
      })();

      // Capture UI state for restoration
      const uiState: DraftUIState = {
        scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
        activeSection: null,
        expandedSections: [],
        lastVisibleSection: null,
      };

      // Fetch existing draft to preserve generated content if proposal exists
      let existingGeneratedContent: Record<string, string> = {};
      if (currentProposalId) {
        try {
          const existingDraft = await getDraftByProposalId(currentProposalId);
          if (existingDraft) {
            const fullDraft = await getDraft(existingDraft.id);
            existingGeneratedContent = fullDraft.generatedContent || {};
            logger.info('[useSaveDraft] Preserved existing generated content', {
              sectionCount: Object.keys(existingGeneratedContent).length
            });
          }
        } catch (error) {
          logger.warn('[useSaveDraft] Failed to fetch existing draft for content preservation', error);
        }
      }

      // Include sections from proposalData if available (for completed proposals)
      const sectionsContent: Record<string, string> = {};

      // Construct proposalData object using granular selectors
      const draftProposalData = {
        title,
        clientName,
        clientId,
        description,
        selectedSections,
        sectionDisplayNames,
        tone,
        lengthPreference,
        language,
        aiModel,
        templateId,
        templateType,
        files: [],
        filesMeta,
        selectedDocumentIds,
        customSections: [],
        contextualInstructions: "",
        webReferences,
        sections: sectionsContent,
      } as any;

      const draftPayload = {
        proposalId: currentProposalId,
        title: title || "Untitled Proposal",
        clientName: clientName || "",
        status: "draft" as const,
        lastLocation,
        stage: draftStage,
        wizardState: {
          proposalData: draftProposalData,
          currentStep,
          maxStepReached,
          completedSteps,
        },
        generatedContent: Object.keys(sectionsContent).length > 0 ? sectionsContent : existingGeneratedContent,
        uiState,
      };

      logger.info('[useSaveDraft] Saving draft', {
        proposalId: currentProposalId,
        hasGeneratedContent: Object.keys(draftPayload.generatedContent).length > 0,
        sectionCount: Object.keys(draftPayload.generatedContent).length,
        stage: draftStage,
        lastLocation,
        // Log the critical fields to verify they're being saved
        title,
        clientName,
        selectedSectionsCount: selectedSections.length,
        filesMetaCount: filesMeta.length,
        selectedDocumentIdsCount: selectedDocumentIds?.length || 0,
        webReferencesCount: webReferences.length,
        sectionDisplayNamesKeys: Object.keys(sectionDisplayNames).length,
      });

      console.log('[useSaveDraft] Draft payload being saved:', {
        proposalId: currentProposalId,
        title,
        clientName,
        selectedSections,
        sectionDisplayNames,
        filesMeta,
        selectedDocumentIds,
        webReferences,
        tone,
        lengthPreference,
        language,
        aiModel,
        templateId,
        templateType,
        stage: draftStage,
        lastLocation,
      });

      if (currentDraftId) {
        // Update existing draft
        await updateDraftInStore(currentDraftId, draftPayload);
        toast.success(MESSAGES.DRAFT_SAVED);
      } else {
        // Create new draft and store ID
        const saved = await saveDraftToStore(draftPayload);
        setCurrentDraftId(saved.id);
        toast.success(MESSAGES.DRAFT_SAVED);
      }

      // Navigate first, then reset to avoid infinite re-render loop
      router.push("/");

      // Reset after navigation to prevent @dnd-kit infinite loop
      setTimeout(() => {
        resetProposal();
      }, 100);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save draft";
      toast.error(message);
      throw error;
    } finally {
      localStorage.removeItem(DRAFT_SAVE_LOCK_KEY);
    }
  };
}
