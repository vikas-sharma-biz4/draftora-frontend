"use client";

import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/utils/toast";
import { MESSAGES } from "@/constants/messages";
import { logger } from "@/utils/logger";

import {
  useProposalTitle,
  useClientName,
  useProposalDescription,
  useSelectedSections,
  useSectionDisplayNames,
  useTone,
  useLengthPreference,
  useLanguage,
  useAiModel,
  useTemplateId,
  useTemplateType,
  useCurrentStep,
  useMaxStepReached,
  useCurrentProposalId,
  useWizardActions,
} from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { updateDraft as updateDraftApi, getDraftByProposalId, getDraft } from "@/services/draft.service";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import type { DraftLocation, DraftUIState } from "@/interfaces/draftInterfaces";

/**
 * Returns a `saveDraft` function that persists the current wizard state to
 * the backend database, resets the wizard, and navigates back to the root.
 */
export function useSaveDraft(): () => Promise<void> {
  const title = useProposalTitle();
  const clientName = useClientName();
  const description = useProposalDescription();
  const selectedSections = useSelectedSections();
  const sectionDisplayNames = useSectionDisplayNames();
  const tone = useTone();
  const lengthPreference = useLengthPreference();
  const language = useLanguage();
  const aiModel = useAiModel();
  const templateId = useTemplateId();
  const templateType = useTemplateType();
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
  const invalidateCache = useDraftStore(state => state.invalidateCache);
  const saveDraftToStore = useDraftStore(state => state.saveDraft);
  const updateDraftInStore = useDraftStore(state => state.updateDraftApi);

  return async function saveDraft(): Promise<void> {
    const hasData = title.trim() !== "" || clientName.trim() !== "";

    if (!hasData) {
      toast.error("Nothing to save — add a title or client name first.");
      return;
    }

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

    try {
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

      // Construct minimal proposalData object for backward compatibility
      const proposalData = {
        title,
        clientName,
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
        filesMeta: [],
        selectedDocumentIds: [],
        customSections: [],
        contextualInstructions: "",
        webReferences: [],
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
          proposalData: { ...proposalData, files: [] },
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

      // Invalidate cache to force fresh fetch on drafts page
      invalidateCache();

      resetProposal();
      router.push("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save draft";
      toast.error(message);
    }
  };
}
