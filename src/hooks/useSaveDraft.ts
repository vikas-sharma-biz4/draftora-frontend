"use client";

import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/utils/toast";
import { MESSAGES } from "@/constants/messages";

import { useProposalWizard, useProposalDraftSession } from "@/context/ProposalContext";
import { updateDraft as updateDraftApi } from "@/services/draft.service";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import type { DraftLocation, DraftUIState } from "@/interfaces/draftInterfaces";

/**
 * Returns a `saveDraft` function that persists the current wizard state to
 * the backend database, resets the wizard, and navigates back to the root.
 */
export function useSaveDraft(): () => Promise<void> {
  const { proposalData, currentStep, maxStepReached, resetProposal, currentProposalId } = useProposalWizard();
  const { completedSteps } = useProposalDraftSession();
  const router = useRouter();
  const pathname = usePathname();
  const currentDraftId = useDraftSessionStore(state => state.currentDraftId);
  const draftStage = useDraftSessionStore(state => state.draftStage);
  const setCurrentDraftId = useDraftSessionStore(state => state.setCurrentDraftId);
  const invalidateCache = useDraftStore(state => state.invalidateCache);
  const saveDraftToStore = useDraftStore(state => state.saveDraft);
  const updateDraftInStore = useDraftStore(state => state.updateDraftApi);

  return async function saveDraft(): Promise<void> {
    const hasData =
      proposalData.title.trim() !== "" || proposalData.clientName.trim() !== "";

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
      const draftPayload = {
        proposalId: currentProposalId,
        title: proposalData.title || "Untitled Proposal",
        clientName: proposalData.clientName || "",
        status: "draft" as const,
        lastLocation,
        stage: draftStage,
        wizardState: {
          proposalData: { ...proposalData, files: [] },
          currentStep,
          maxStepReached,
          completedSteps,
        },
        generatedContent: {},
        uiState,
      };

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
