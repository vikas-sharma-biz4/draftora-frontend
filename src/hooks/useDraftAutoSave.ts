"use client";

import { useEffect } from "react";

import { useProposal } from "@/context/ProposalContext";
import { saveDraft as saveDraftApi, updateDraft as updateDraftApi } from "@/services/draftApi";
import { useDraftStore } from "@/redux/features/draftStore";
import type { DraftLocation, DraftUIState } from "@/interfaces/draftInterfaces";

interface UseDraftAutoSaveOptions {
  enabled: boolean;
}

/**
 * Auto-saves the current proposal state to backend database when:
 * - The browser is closing (beforeunload event)
 * - The tab is hidden (visibilitychange event)
 * 
 * This ensures work is not lost when users close the browser or their PC shuts down.
 * Drafts are persisted across different users and devices.
 */
export function useDraftAutoSave(options: UseDraftAutoSaveOptions): void {
  const { enabled } = options;
  const {
    proposalData,
    currentStep,
    draftStage,
    completedSteps,
    maxStepReached,
    currentProposalId,
    currentDraftId,
    setCurrentDraftId,
  } = useProposal();
  const invalidateCache = useDraftStore(state => state.invalidateCache);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Check if there's meaningful data to save
    // Include: title, clientName, description, selected sections, or if we're past the initial stage
    const hasData =
      proposalData.title.trim() !== "" ||
      proposalData.clientName.trim() !== "" ||
      proposalData.description.trim() !== "" ||
      (proposalData.selectedSections && proposalData.selectedSections.length > 0) ||
      draftStage !== "template_selection";

    if (!hasData) {
      return;
    }

    // Determine lastLocation based on current pathname
    const getLastLocation = (): DraftLocation => {
      if (typeof window !== "undefined") {
        const pathname = window.location.pathname;
        if (pathname === "/parameters") return "WIZARD_PARAMETERS";
        if (pathname === "/review") return "WIZARD_REVIEW";
        if (pathname.startsWith("/proposal/") || pathname === "/web-view") return "WEB_VIEW";
      }
      return "WIZARD_PARAMETERS";
    };

    const saveToDrafts = async (): Promise<void> => {
      try {
        // Capture UI state for restoration
        const uiState: DraftUIState = {
          scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
          activeSection: null,
          expandedSections: [],
          lastVisibleSection: null,
        };

        const draftPayload = {
          proposalId: currentProposalId,
          title: proposalData.title || "Untitled Proposal",
          clientName: proposalData.clientName || "",
          status: "draft" as const,
          lastLocation: getLastLocation(),
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
          console.log("Auto-save draft updated:", draftPayload.title);
        } else {
          // Create new draft and store ID in context
          const saved = await saveDraftApi(draftPayload);
          setCurrentDraftId(saved.id);
          console.log("Auto-save draft created:", draftPayload.title);
        }
        
        // Invalidate cache so draft list will show updated status
        invalidateCache();
      } catch (error) {
        console.error("Auto-save to drafts failed:", error);
      }
    };

    const handleBeforeUnload = (): void => {
      // Use synchronous localStorage as fallback for beforeunload
      // since async fetch won't complete before unload
      try {
        const draftData = {
          id: currentDraftId || `draft_${Date.now()}`,
          savedAt: new Date().toISOString(),
          title: proposalData.title || "Untitled Proposal",
          clientName: proposalData.clientName || "",
          currentStep,
          draftStage,
          lastLocation: getLastLocation(),
          maxStepReached,
          completedSteps,
          proposalData: { ...proposalData, files: [] },
          uiState: {
            scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
            activeSection: null,
            expandedSections: [],
            lastVisibleSection: null,
          },
        };

        const raw = localStorage.getItem("drafts_autosave_fallback");
        const existing = raw ? JSON.parse(raw) : [];
        const filtered = existing.filter((d: any) => d.title !== draftData.title);
        localStorage.setItem("drafts_autosave_fallback", JSON.stringify([draftData, ...filtered]));
        console.log("Auto-save fallback stored in localStorage");
      } catch (error) {
        console.error("Auto-save fallback failed:", error);
      }
    };

    const handleVisibilityChange = (): void => {
      // Save when tab is hidden (user switches tabs or minimizes browser)
      if (document.hidden) {
        void saveToDrafts();
      }
    };

    const handlePageHide = (): void => {
      // Save when page is hidden (more reliable than beforeunload in some browsers)
      void saveToDrafts();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [
    enabled,
    proposalData,
    currentStep,
    draftStage,
    completedSteps,
    maxStepReached,
    currentProposalId,
    currentDraftId,
    setCurrentDraftId,
    invalidateCache,
  ]);
}
