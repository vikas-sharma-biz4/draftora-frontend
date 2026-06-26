"use client";

import { useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/utils/toast";
import { MESSAGES } from "@/constants/messages";
import { logger } from "@/utils/logger";

import { useProposalWizardStore } from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { getDraftByProposalId, getDraft } from "@/services/draft.service";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import { HttpError } from "@/config/httpClient";
import type { DraftLocation, DraftUIState } from "@/interfaces/draftInterfaces";
import { buildDraftProposalData, buildDraftPayload } from "@/utils/draftUtils";

/**
 * Returns a `saveDraft` function that persists the current wizard state to
 * the backend database, resets the wizard, and navigates back to the root.
 *
 * All wizard and session state is read via `.getState()` inside the returned
 * async function rather than from React hook closures. This guarantees the
 * latest Zustand state is used even when `updateProposalData()` was called
 * immediately before invoking this function (e.g. syncing sections before save).
 */
export function useSaveDraft(): () => Promise<void> {
  const router = useRouter();
  const pathname = usePathname();
  // In-memory lock: prevents concurrent saves within the same hook instance.
  const isSavingRef = useRef<boolean>(false);

  return async function saveDraft(): Promise<void> {
    // Read all state at call-time so we always get the latest synchronous Zustand values.
    const wizardState = useProposalWizardStore.getState();
    const {
      proposalData,
      currentStep,
      maxStepReached,
      currentProposalId,
      generatedProposalId,
      prefetchedRecommendations,
      resetProposal,
    } = wizardState;
    const {
      title,
      clientName,
      clientId,
      description,
      selectedSections,
      sectionDisplayNames,
      customSections,
      tone,
      lengthPreference,
      language,
      aiModel,
      templateId,
      templateType,
      filesMeta,
      selectedDocumentIds,
      webReferences,
      approvalStatus,
    } = proposalData;

    const sessionState = useDraftSessionStore.getState();
    const {
      completedSteps,
      currentDraftId,
      draftStage,
      setCurrentDraftId,
      generatedContent: cachedGeneratedContent,
      setGeneratedContent,
    } = sessionState;

    const { saveDraft: saveDraftToStore, updateDraftApi: updateDraftInStore } =
      useDraftStore.getState();

    // Never save drafts for proposals that have been reviewed (approved or rejected)
    if (approvalStatus === "approved" || approvalStatus === "rejected") {
      toast.error(MESSAGES.DRAFT_SAVE_REJECTED);
      return;
    }

    // If a proposal ID is linked but approval status hasn't loaded from the API yet,
    // block the save. Sending proposal_id before we know its approval state risks a 400.
    if (currentProposalId && approvalStatus === undefined) {
      toast.error(MESSAGES.DRAFT_SAVE_LOADING);
      return;
    }

    if (isSavingRef.current) {
      logger.debug("[useSaveDraft] Save already in progress, skipping");
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

    isSavingRef.current = true;

    try {
      const lastLocation: DraftLocation = (() => {
        if (pathname === "/parameters") return "wizard_parameters";
        if (pathname === "/review") return "wizard_review";
        if (pathname.startsWith("/proposal/")) return "web_view";
        return "wizard_parameters";
      })();

      const uiState: DraftUIState = {
        scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
        activeSection: null,
        expandedSections: [],
        lastVisibleSection: null,
      };

      // Use the in-memory generatedContent cache to avoid redundant API round-trips.
      // Only fetch from the backend when the cache is empty (first save after resuming).
      let existingGeneratedContent: Record<string, string> = cachedGeneratedContent;

      if (Object.keys(existingGeneratedContent).length === 0 && currentProposalId) {
        try {
          const existingDraft = await getDraftByProposalId(currentProposalId);
          if (existingDraft) {
            const fullDraft = await getDraft(existingDraft.id);
            existingGeneratedContent = fullDraft.generatedContent || {};
            setGeneratedContent(existingGeneratedContent);
            logger.info("[useSaveDraft] Fetched and cached generated content", {
              sectionCount: Object.keys(existingGeneratedContent).length,
            });
          }
        } catch (error) {
          logger.warn(
            "[useSaveDraft] Failed to fetch existing draft for content preservation",
            error
          );
        }
      }

      const draftProposalData = buildDraftProposalData({
        title,
        clientName,
        clientId,
        description,
        selectedSections,
        sectionDisplayNames,
        customSections,
        tone,
        lengthPreference,
        language,
        aiModel,
        templateId,
        templateType,
        filesMeta,
        selectedDocumentIds,
        webReferences,
      });

      const draftPayload = buildDraftPayload({
        proposalId: currentProposalId ?? generatedProposalId,
        title,
        clientName,
        lastLocation,
        stage: draftStage,
        proposalData: draftProposalData,
        currentStep,
        maxStepReached,
        completedSteps,
        generatedContent: existingGeneratedContent,
        uiState,
        prefetchedRecommendations: prefetchedRecommendations ?? null,
      });

      logger.info("[useSaveDraft] Saving draft", {
        proposalId: currentProposalId,
        hasGeneratedContent: Object.keys(draftPayload.generatedContent).length > 0,
        sectionCount: Object.keys(draftPayload.generatedContent).length,
        stage: draftStage,
        lastLocation,
        title,
        clientName,
        selectedSectionsCount: selectedSections.length,
        filesMetaCount: filesMeta.length,
        selectedDocumentIdsCount: selectedDocumentIds?.length || 0,
        webReferencesCount: webReferences.length,
        sectionDisplayNamesKeys: Object.keys(sectionDisplayNames).length,
      });

      if (currentDraftId) {
        try {
          await updateDraftInStore(currentDraftId, draftPayload);
          toast.success(MESSAGES.DRAFT_SAVED);
        } catch (updateError) {
          const is404 = updateError instanceof HttpError && updateError.statusCode === 404;
          if (is404) {
            // Draft was deleted from backend — create fresh
            setCurrentDraftId(null);
            const saved = await saveDraftToStore(draftPayload);
            setCurrentDraftId(saved.id);
            toast.success(MESSAGES.DRAFT_SAVED);
          } else {
            throw updateError;
          }
        }
      } else {
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
    } finally {
      isSavingRef.current = false;
    }
  };
}
