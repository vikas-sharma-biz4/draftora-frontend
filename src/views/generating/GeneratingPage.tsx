"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useMemo } from "react";

import { cancelProposal, getProposal } from "@/services/proposal.service";
import { GENERATION_STEPS, DRAFTS_STORAGE_KEY } from "@/constants";
import { useWizardActions } from "@/store/features/wizard/proposalWizardSlice";
import { logger } from "@/utils/logger";
import { useProposalStatusPolling } from "@/hooks/useProposalStatusPolling";
import type { ProposalStatus } from "@/interfaces/proposalInterfaces";
import {
  useGenerationProgress,
  useGenerationError,
  useGenerationIsPolling,
  useGenerationCurrentSection,
  useGenerationCurrentStage,
  useGenerationEstimatedTime,
  useGenerationTotalSections,
  useGenerationCompletedSections,
  useGenerationActions,
} from "@/store/features/generation/generationSlice";
import { useProposalWizardStore } from "@/store/features/wizard/proposalWizardSlice";
import Button from "@/components/common/Button";
import CircularProgress from "@/components/common/CircularProgress";

export default function GeneratingPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const proposalId = Number(params.id);
  console.log("[GeneratingPage] Component mounted at", new Date().toISOString(), "proposalId:", proposalId, "params.id:", params.id);

  const { setIsGenerating, resetProposal } = useWizardActions();

  // Validate proposalId
  if (!proposalId || isNaN(proposalId)) {
    logger.error("[GeneratingPage] Invalid proposal ID from URL params:", params.id);
    router.push("/review");
    return <div>Redirecting...</div>;
  }

  // Zustand selectors
  const progressPercent = useGenerationProgress();
  const errorMessage = useGenerationError();
  const isPolling = useGenerationIsPolling();
  const currentSection = useGenerationCurrentSection();
  const currentStage = useGenerationCurrentStage();
  const estimatedTimeRemaining = useGenerationEstimatedTime();
  const totalSections = useGenerationTotalSections();
  const completedSections = useGenerationCompletedSections();
  const { startGeneration, updateFromStatus, setPolling, setError, completeGeneration, failGeneration } = useGenerationActions();


  const completedRef = useRef<boolean>(false);

  const handleCompleted = useCallback(async () => {
    console.log("[GeneratingPage] handleCompleted called - navigating to web view for proposal:", proposalId);
    completedRef.current = true;

    setIsGenerating(false);
    completeGeneration();

    sessionStorage.removeItem("pending_proposal_id");
    sessionStorage.removeItem("generation_status");
    sessionStorage.removeItem("pending_proposal_data");

    // Fetch full proposal and save as draft
    try {
      console.log("[GeneratingPage] Fetching proposal data for proposalId:", proposalId);
      const proposalData = await getProposal(proposalId);
      console.log("[GeneratingPage] Proposal data fetched successfully");

      const draftItem = {
        id: proposalId.toString(),
        title: proposalData.title,
        clientName: proposalData.clientName,
        stage: "generated" as const,
        status: "pending_approval" as const,
        createdAt: proposalData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: proposalData,
      };
      const drafts: Array<{ id: string }> = JSON.parse(localStorage.getItem(DRAFTS_STORAGE_KEY) || "[]");
      const existingIndex = drafts.findIndex((d) => d.id === draftItem.id);
      if (existingIndex >= 0) {
        drafts[existingIndex] = draftItem;
      } else {
        drafts.unshift(draftItem);
      }
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
      console.log("[GeneratingPage] Draft saved to localStorage");
    } catch (error) {
      console.error("[GeneratingPage] Failed to save draft:", error);
      logger.error("Failed to save draft:", error);
    }

    console.log("[GeneratingPage] Navigating to /proposal/", proposalId);
    router.push(`/proposal/${proposalId}`);
  }, [proposalId, router, setIsGenerating, completeGeneration]);

  const handleFailed = useCallback(() => {
    completedRef.current = true;
    setIsGenerating(false);
    failGeneration();
  }, [setIsGenerating, failGeneration]);

  const handleCancelled = useCallback(() => {
    completedRef.current = true;
    setIsGenerating(false);
    sessionStorage.removeItem("pending_proposal_id");
    sessionStorage.removeItem("generation_status");
    sessionStorage.removeItem("pending_proposal_data");
    router.push("/review");
  }, [router, setIsGenerating]);

  const pollingCallbacks = useMemo(
    () => ({
      onStatusUpdate: (data: ProposalStatus) => {
        logger.debug("[GeneratingPage] Status update", {
          status: data.status,
          progressPercent: data.progressPercent,
          currentStage: data.currentStage,
          currentSection: data.currentSection,
          completedCount: data.completedSections.length,
          totalSections: data.totalSections,
        });
        updateFromStatus(data);
      },
      onCompleted: () => {
        void handleCompleted();
      },
      onFailed: () => {
        handleFailed();
      },
      onCancelled: () => {
        handleCancelled();
      },
      onError: (error: Error) => {
        logger.error("[GeneratingPage] Polling error:", error);
        setError("Unable to check proposal status. Please refresh and try again.");
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateFromStatus, handleCompleted, handleFailed, handleCancelled, setError]
  );

  console.log("[GeneratingPage] About to call useProposalStatusStream with proposalId:", proposalId, "Type:", typeof proposalId, "Is NaN:", isNaN(proposalId));

  const {
    errorMessage: pollingError,
    isPolling: hookIsPolling,
    pollCount,
    stop: stopPolling,
  } = useProposalStatusPolling({
    proposalId,
    onStatusUpdate: (data: ProposalStatus) => {
      logger.debug("[GeneratingPage] Status update", {
        status: data.status,
        progressPercent: data.progressPercent,
        currentStage: data.currentStage,
        currentSection: data.currentSection,
        completedCount: data.completedSections.length,
        totalSections: data.totalSections,
      });
      updateFromStatus(data);
    },
    onCompleted: () => {
      void handleCompleted();
    },
    onFailed: () => {
      handleFailed();
    },
    onCancelled: () => {
      handleCancelled();
    },
    onError: (error: Error) => {
      logger.error("[GeneratingPage] Polling error:", error);
      setError("Unable to check proposal status. Please refresh and try again.");
    },
  });

  // Stabilize callbacks in refs so effects don't loop on reference changes
  const startGenerationRef = useRef(startGeneration);
  startGenerationRef.current = startGeneration;
  const setIsGeneratingRef = useRef(setIsGenerating);
  setIsGeneratingRef.current = setIsGenerating;
  const setPollingRef = useRef(setPolling);
  setPollingRef.current = setPolling;
  const setErrorRef = useRef(setError);
  setErrorRef.current = setError;
  const stopPollingRef = useRef(stopPolling);
  stopPollingRef.current = stopPolling;

  // Sync hook polling state into Zustand store
  useEffect(() => {
    setPollingRef.current(hookIsPolling);
  }, [hookIsPolling]);

  // Sync hook error into Zustand store
  useEffect(() => {
    if (pollingError) {
      setErrorRef.current(pollingError);
    }
  }, [pollingError]);

  // Initialize generation state on mount
  useEffect(() => {
    startGenerationRef.current(proposalId);
    setIsGeneratingRef.current(true);

    return () => {
      stopPollingRef.current();
      if (!completedRef.current) {
        setIsGeneratingRef.current(false);
      }
    };
  }, [proposalId]);

  // ── Render helpers ──

  const getActiveStepIndex = (): number => {
    if (!currentStage) {
      const progressRatio = progressPercent / 100;
      if (progressRatio < 0.05) return 0;
      if (progressRatio < 0.20) return 1;
      if (progressRatio < 0.85) return 2;
      if (progressRatio < 0.97) return 3;
      return GENERATION_STEPS.length - 1;
    }
    switch (currentStage) {
      case "parsing":
      case "initializing":
        return 0;
      case "validating":
      case "analyzing":
        return 1;
      case "generating":
        const progressRatio = progressPercent / 100;
        if (progressRatio < 0.33) return 2;
        if (progressRatio < 0.90) return 3;
        return 4;
      case "finalizing":
      case "polishing":
        return 5;
      default:
        return 0;
    }
  };

  const activeStepIndex = getActiveStepIndex();

  const steps = [
    "Analyzing source materials...",
    "Mapping strategic objectives...",
    "Generating executive summary...",
    "Drafting technical specifications...",
    "Polishing final document structure.",
  ];

  const timeRemainingText = estimatedTimeRemaining
    ? `${estimatedTimeRemaining}s`
    : "30-45 seconds";

  if (errorMessage) {
    completedRef.current = true;
    return (
      <div className="generating-page">
        <div className="generating-container">
          <div className="generating-error-state">
            <div className="generating-error-icon">✗</div>
            <h2 className="generating-error-title">Generation Failed</h2>
            <p className="generating-error-desc">{errorMessage}</p>
            <div className="generating-error-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setIsGenerating(false);
                  router.push("/review");
                }}
              >
                ← Back to Review
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  resetProposal();
                  router.push("/");
                }}
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="generating-page">
      <div className="generating-container">
        <h1 className="generating-main-title">Architecting Your Proposal...</h1>
        <p className="generating-main-subtitle">
          The AI is weaving together your context, source materials, and
          parameters into a production-grade document.
        </p>

        <div className="generating-content">
          {/* Left side - Progress Circle */}
          <div className="generating-progress-section">
            <CircularProgress progress={progressPercent} size={240} strokeWidth={8} label={`${Math.round(progressPercent)}%`} />
            <div className="generating-time-label">TIME REMAINING</div>
            <div className="generating-time-value">{timeRemainingText}</div>
            {isPolling && (
              <div className="generating-poll-badge">
                Polling ({pollCount}/120)
              </div>
            )}
            {currentSection && (
              <div className="generating-current-section" style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
                Current: {currentSection.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            )}
          </div>

          {/* Right side - Build Sequence */}
          <div className="generating-sequence-section">
            <div className="generating-sequence-header">
              GENERATING SECTIONS ({completedSections}/{totalSections})
            </div>
            <ul className="generating-sequence-list">
              {currentSection ? (
                <li className="generating-sequence-item active">
                  <span className="generating-sequence-icon">◐</span>
                  <span className="generating-sequence-text">
                    {currentSection.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    <span className="generating-sequence-status"> - Generating...</span>
                  </span>
                </li>
              ) : (
                <li className="generating-sequence-item">
                  <span className="generating-sequence-icon">○</span>
                  <span className="generating-sequence-text">Loading sections...</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <Button
          variant="danger"
          size="md"
          onClick={async () => {
            completedRef.current = true;
            stopPolling();
            await cancelProposal(proposalId).catch(() => undefined);
            setIsGenerating(false);
            sessionStorage.removeItem("pending_proposal_id");
            sessionStorage.removeItem("generation_status");
            sessionStorage.removeItem("pending_proposal_data");
            router.push("/review");
          }}
          className="generating-cancel-btn"
        >
          Cancel Generation
        </Button>
      </div>
    </div>
  );
}
