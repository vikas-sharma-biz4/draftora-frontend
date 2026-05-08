"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useProposal } from "@/context/ProposalContext";
import { saveDraft as saveDraftApi, updateDraft as updateDraftApi } from "@/services/draftApi";
import { useDraftStore } from "@/redux/features/draftStore";
import type { ProposalData, WizardStep } from "@/interfaces/proposalInterfaces";
import type { DraftStage, DraftLocation, DraftUIState } from "@/interfaces/draftInterfaces";

/**
 * Returns a `saveDraft` function that persists the current wizard state to
 * the backend database, resets the wizard, and navigates back to the root.
 */
export function useSaveDraft(): () => Promise<void> {
  const { proposalData, currentStep, draftStage, completedSteps, maxStepReached, resetProposal, currentProposalId, currentDraftId, setCurrentDraftId } = useProposal();
  const router = useRouter();
  const invalidateCache = useDraftStore(state => state.invalidateCache);

  return async function saveDraft(): Promise<void> {
    const hasData =
      proposalData.title.trim() !== "" || proposalData.clientName.trim() !== "";

    if (!hasData) {
      toast.error("Nothing to save — add a title or client name first.");
      return;
    }

    // Determine lastLocation based on current pathname
    const lastLocation: DraftLocation = (() => {
      if (typeof window !== "undefined") {
        const pathname = window.location.pathname;
        if (pathname === "/parameters") return "WIZARD_PARAMETERS";
        if (pathname === "/review") return "WIZARD_REVIEW";
        if (pathname.startsWith("/proposal/") || pathname === "/web-view") return "WEB_VIEW";
      }
      return "WIZARD_PARAMETERS";
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
        await updateDraftApi(currentDraftId, draftPayload);
        toast.success(`Draft "${proposalData.title || "Untitled Proposal"}" updated.`);
      } else {
        // Create new draft and store ID
        const saved = await saveDraftApi(draftPayload);
        setCurrentDraftId(saved.id);
        toast.success(`Draft "${proposalData.title || "Untitled Proposal"}" saved.`);
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
