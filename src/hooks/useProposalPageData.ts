/**
 * useProposalPageData — data fetching hook for ProposalOutputPage
 *
 * Encapsulates:
 * - Fetching proposal data from the API
 * - Polling redirect logic (redirects to /generating if not completed)
 * - Syncing visited pipeline steps from backend
 * - Restoring UI state from draft session storage
 * - Auto-save to drafts on unmount / beforeunload
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/utils/logger";
import { useCurrentStep, useMaxStepReached, useCurrentProposalId, useEditMode, useWizardActions } from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { usePipelineSteps } from "@/hooks/usePipelineSteps";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";
import {
  getProposal,
} from "@/services/proposal.service";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import type { ProposalData, WizardStep } from "@/interfaces/proposalInterfaces";
import type { DraftUIState } from "@/interfaces/draftInterfaces";

interface UseProposalPageDataReturn {
  proposal: ProposalData | null;
  setProposal: React.Dispatch<React.SetStateAction<ProposalData | null>>;
  isLoading: boolean;
  errorMessage: string;
  activeSection: string;
  setActiveSection: React.Dispatch<React.SetStateAction<string>>;
  fromHistory: boolean;
  fetchProposal: () => Promise<void>;
}

export function useProposalPageData(
  proposalId: number,
  searchParams: URLSearchParams
): UseProposalPageDataReturn {
  const router = useRouter();
  const { setCurrentProposalId, updateProposalData } = useWizardActions();
  const { syncVisitedStepsFromBackend } = usePipelineSteps();
  const setDraftStage = useDraftSessionStore(state => state.setDraftStage);
  const setCompletedSteps = useDraftSessionStore(state => state.setCompletedSteps);
  const markStepCompleted = useDraftSessionStore(state => state.markStepCompleted);
  const updateProposalInStore = useProposalStore(state => state.updateProposal);

  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeSection, setActiveSection] = useState<string>("");
  const [fromHistory, setFromHistory] = useState<boolean>(false);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSectionRef = useRef<string>(activeSection);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  // Check if navigating from History
  useEffect(() => {
    const fromParam = searchParams.get("from");
    setFromHistory(fromParam === "history");
  }, [searchParams]);

  // Mark step 3 as visited when this page loads
  useEffect(() => {
    markStepCompleted(3);
  }, [markStepCompleted]);

  // Sync visited steps from backend on mount
  useEffect(() => {
    if (proposalId) {
      syncVisitedStepsFromBackend(proposalId);
    }
  }, [proposalId, syncVisitedStepsFromBackend]);

  const fetchProposal = useCallback(async (): Promise<void> => {
    try {
      logger.info(`[useProposalPageData] Fetching proposal ${proposalId}`);
      const data = await getProposal(proposalId);

      if (!data) {
        throw new Error("Proposal data is null or undefined");
      }

      logger.info(`[useProposalPageData] Proposal fetched successfully:`, {
        id: data.id,
        status: data.status,
        title: data.title,
        sectionsCount: Object.keys(data.sections || {}).length,
      });

      setProposal(data);

      // Set current proposal ID for regeneration flow
      setCurrentProposalId(proposalId);

      if (data.status === "completed") {
        setIsLoading(false);
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        const sections = data.selectedSections ?? [];
        if (sections.length > 0 && !activeSectionRef.current) {
          setActiveSection(sections[0]);
        }

        // Update proposal context with current data for regeneration
        updateProposalData({
          title: data.title || "",
          clientName: data.clientName || "",
          clientId: data.clientId,
          description: data.description || "",
          tone: data.tone,
          lengthPreference: data.lengthPreference,
          language: data.language || "English",
          aiModel: data.aiModel,
          selectedSections: data.selectedSections || [],
          sectionDisplayNames: data.sectionDisplayNames || {},
          contextualInstructions: data.contextualInstructions || "",
          webReferences: data.webReferences || [],
        });
        setDraftStage("generated");
        setCompletedSteps([1, 2, 3]);
        return;
      }

      if (data.status === "failed") {
        setIsLoading(false);
        setErrorMessage("Proposal generation failed. Please go back and try again.");
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        return;
      }

      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      logger.info(`[useProposalPageData] Proposal status is ${data.status}, redirecting to generating page`);
      router.replace(`/generating/${proposalId}`);
    } catch (err: unknown) {
      logger.error(`[useProposalPageData] Error fetching proposal ${proposalId}:`, err);
      const message = err instanceof Error ? err.message : "Failed to load proposal.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }, [proposalId, router, setCurrentProposalId, updateProposalData, setDraftStage, setCompletedSteps]);

  useEffect(() => {
    fetchProposal();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchProposal]);

  // Restore scroll position and active section from draft UI state
  useEffect(() => {
    try {
      const uiStateStr = sessionStorage.getItem("draft_ui_state");
      if (uiStateStr) {
        const uiState = JSON.parse(uiStateStr) as DraftUIState;

        // Restore active section if available
        if (uiState.activeSection && proposal?.selectedSections?.includes(uiState.activeSection)) {
          setActiveSection(uiState.activeSection);
        }

        // Restore scroll position
        if (uiState.scrollPosition > 0) {
          setTimeout(() => {
            window.scrollTo({
              top: uiState.scrollPosition,
              behavior: "smooth",
            });
          }, 300);
        }

        sessionStorage.removeItem("draft_ui_state");
      }
    } catch {
      // Ignore errors restoring UI state
    }
  }, [proposal]);

  // Auto-save to drafts when navigating away without approval/rejection
  useDraftPersistence({
    enabled: proposal?.status === "completed",
    proposalId,
    proposal,
    activeSection,
    lastLocation: "web_view",
    stage: "generated",
  });

  return {
    proposal,
    setProposal,
    isLoading,
    errorMessage,
    activeSection,
    setActiveSection,
    fromHistory,
    fetchProposal,
  };
}
