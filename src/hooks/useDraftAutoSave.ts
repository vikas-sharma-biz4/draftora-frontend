"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
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
  useCurrentProposalId,
} from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
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
  const currentProposalId = useCurrentProposalId();
  const draftStage = useDraftSessionStore(state => state.draftStage);
  const pathname = usePathname();

  // Determine lastLocation based on current pathname
  const getLastLocation = (): DraftLocation => {
    return getLastLocationFromPathname(pathname);
  };

  // Check if there's meaningful data to save
  const hasData =
    enabled &&
    currentProposalId != null &&
    clientName.trim() !== "" &&
    (title.trim() !== "" ||
      description.trim() !== "" ||
      (selectedSections && selectedSections.length > 0) ||
      draftStage !== "template_selection");

  // Memoize proposalData object to prevent reference changes on every render
  const proposalData = useMemo(() => ({
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
  }), [title, clientName, description, selectedSections, sectionDisplayNames, tone, lengthPreference, language, aiModel, templateId, templateType]);

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
