"use client";

import { useEffect } from "react";

import { DRAFTS_STORAGE_KEY } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import type { DraftLocation } from "@/types/draft.types";

interface UseDraftAutoSaveOptions {
  enabled: boolean;
}

/**
 * Auto-saves the current proposal state to localStorage drafts when:
 * - The browser is closing (beforeunload event)
 * - The tab is hidden (visibilitychange event)
 * 
 * This ensures work is not lost when users close the browser or their PC shuts down.
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
  } = useProposal();

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

    const saveToDrafts = (): void => {
      try {
        const draft = {
          id: Date.now().toString(),
          savedAt: new Date().toISOString(),
          title: proposalData.title || "Untitled Proposal",
          clientName: proposalData.clientName || "",
          currentStep,
          draftStage,
          lastLocation: getLastLocation(),
          maxStepReached,
          completedSteps,
          proposalData: { ...proposalData, files: [] },
        };

        const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
        const existing = raw ? JSON.parse(raw) : [];

        // Update existing draft with same title, or add new one
        const filtered = existing.filter((d: { title: string }) => d.title !== draft.title);
        const updated = [draft, ...filtered];

        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updated));
        console.log("Auto-save draft saved:", draft.title);
      } catch (error) {
        console.error("Auto-save to drafts failed:", error);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      // Save synchronously before unload
      try {
        const draft = {
          id: Date.now().toString(),
          savedAt: new Date().toISOString(),
          title: proposalData.title || "Untitled Proposal",
          clientName: proposalData.clientName || "",
          currentStep,
          draftStage,
          lastLocation: getLastLocation(),
          maxStepReached,
          completedSteps,
          proposalData: { ...proposalData, files: [] },
        };

        const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
        const existing = raw ? JSON.parse(raw) : [];

        // Update existing draft with same title, or add new one
        const filtered = existing.filter((d: { title: string }) => d.title !== draft.title);
        const updated = [draft, ...filtered];

        // Store in localStorage synchronously before unload
        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updated));
        console.log("Auto-save on unload saved:", draft.title);
      } catch (error) {
        console.error("Auto-save on unload failed:", error);
      }
    };

    const handleVisibilityChange = (): void => {
      // Save when tab is hidden (user switches tabs or minimizes browser)
      if (document.hidden) {
        saveToDrafts();
      }
    };

    const handlePageHide = (): void => {
      // Save when page is hidden (more reliable than beforeunload in some browsers)
      saveToDrafts();
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
  ]);
}
