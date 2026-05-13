"use client";

import { usePathname } from "next/navigation";
import { getLastLocationFromPathname } from "@/utils/routeUtils";
import { useProposalData, useCurrentStep, useCurrentProposalId } from "@/store/features/wizard/proposalWizardSlice";
import { useProposalDraftSession } from "@/context/ProposalContext";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import type { DraftLocation } from "@/interfaces/draftInterfaces";

interface UseDraftAutoSaveOptions {
  enabled: boolean;
}

/**
 * Auto-saves the current proposal state to backend database when:
 * - The browser is closing (beforeunload event)
 * - The tab is hidden (visibilitychange event)
 *
 * Delegates to useDraftPersistence for all save logic.
 * This hook resolves the lastLocation from the current pathname.
 */
export function useDraftAutoSave(options: UseDraftAutoSaveOptions): void {
  const { enabled } = options;
  const proposalData = useProposalData();
  const currentStep = useCurrentStep();
  const currentProposalId = useCurrentProposalId();
  const { draftStage } = useProposalDraftSession();
  const pathname = usePathname();

  // Determine lastLocation based on current pathname
  const getLastLocation = (): DraftLocation => {
    return getLastLocationFromPathname(pathname);
  };

  // Check if there's meaningful data to save
  const hasData =
    enabled &&
    currentProposalId != null &&
    (proposalData.title.trim() !== "" ||
      proposalData.clientName.trim() !== "" ||
      proposalData.description.trim() !== "" ||
      (proposalData.selectedSections && proposalData.selectedSections.length > 0) ||
      draftStage !== "template_selection");

  useDraftPersistence({
    enabled: hasData,
    proposalId: currentProposalId,
    proposal: hasData ? { ...proposalData, status: "completed", approvalStatus: "pending" } : null,
    activeSection: "",
    lastLocation: getLastLocation(),
    stage: draftStage,
    wizardStep: currentStep,
    skipIfApproved: false,
  });
}
