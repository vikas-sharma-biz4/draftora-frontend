"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DRAFTS_STORAGE_KEY } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import type { ProposalData, WizardStep } from "@/types/proposal.types";
import type { DraftStage, DraftLocation } from "@/types/draft.types";

export interface SavedDraft {
  id: string;
  savedAt: string;
  title: string;
  clientName: string;
  currentStep: WizardStep;
  draftStage: DraftStage;
  lastLocation: DraftLocation;
  maxStepReached: WizardStep;
  completedSteps: number[];
  proposalData: Partial<ProposalData>;
}

/**
 * Returns a `saveDraft` function that persists the current wizard state to
 * localStorage, resets the wizard, and navigates back to the root.
 *
 * No draft limit is enforced — all drafts are kept.
 */
export function useSaveDraft(): () => void {
  const { proposalData, currentStep, draftStage, completedSteps, maxStepReached, resetProposal } = useProposal();
  const router = useRouter();

  return function saveDraft(): void {
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

    const draft: SavedDraft = {
      id: Date.now().toString(),
      savedAt: new Date().toISOString(),
      title: proposalData.title || "Untitled Proposal",
      clientName: proposalData.clientName || "",
      currentStep,
      draftStage,
      lastLocation,
      maxStepReached,
      completedSteps,
      proposalData: { ...proposalData, files: [] },
    };

    try {
      const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
      const existing: SavedDraft[] = raw ? (JSON.parse(raw) as SavedDraft[]) : [];
      const updated = [draft, ...existing];
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      toast.error("Could not save draft — storage may be full.");
      return;
    }

    resetProposal();
    router.push("/");
    toast.success(`Draft "${draft.title}" saved.`);
  };
}
