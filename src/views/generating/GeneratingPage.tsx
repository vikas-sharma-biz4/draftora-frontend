"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cancelProposal } from "@/services/proposal.service";
import { useWizardActions } from "@/store/features/wizard/proposalWizardSlice";
import { logger } from "@/utils/logger";
import { useProposalGenerationStream } from "@/hooks/useProposalGenerationStream";
import { useGenerationStore } from "@/store/features/generation/generationSlice";
import Button from "@/components/common/Button";
import CircularProgress from "@/components/common/CircularProgress";

export default function GeneratingPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const proposalId = Number(params.id);

  const { setIsGenerating, resetProposal } = useWizardActions();

  // Zustand store for generation state
  const {
    status,
    currentStage,
    progressPercent,
    totalSections,
    completedSections,
    currentSection,
    selectedSections,
    completedSectionKeys,
    isConnected,
    isConnecting,
    error,
    setProposalId,
    setJobId,
    setStatus,
    setCurrentStage,
    setProgressPercent,
    setCurrentSection,
    setSelectedSections,
    addCompletedSection,
    setTotalSections,
    setConnectionState,
    setError,
    setStartedAt,
    setCompletedAt,
    reset: resetGenerationState,
  } = useGenerationStore();

  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    setProposalId(proposalId);
    setStartedAt(new Date().toISOString());
  }, [proposalId, setProposalId, setStartedAt]);

  const handleCompleted = useCallback(() => {
    logger.info("[GeneratingPage] Generation completed, navigating to proposal view", { proposalId });
    setIsGenerating(false);
    setCompletedAt(new Date().toISOString());
    
    // Navigate to proposal view
    router.push(`/proposal/${proposalId}`);
  }, [proposalId, router, setIsGenerating, setCompletedAt]);

  const handleFailed = useCallback((message: string) => {
    logger.error("[GeneratingPage] Generation failed", { message, proposalId });
    setIsGenerating(false);
    setError(message);
  }, [proposalId, setIsGenerating, setError]);

  const handleCancelled = useCallback(() => {
    logger.info("[GeneratingPage] Generation cancelled", { proposalId });
    setIsGenerating(false);
    router.push("/review");
  }, [proposalId, router, setIsGenerating]);

  const handleStageChanged = useCallback((stage: string) => {
    logger.info("[GeneratingPage] Stage changed", { stage, proposalId });
    setCurrentStage(stage);
  }, [proposalId, setCurrentStage]);

  const handleSectionStarted = useCallback((section: string) => {
    logger.info("[GeneratingPage] Section started", { section, proposalId });
    setCurrentSection(section);
  }, [proposalId, setCurrentSection]);

  const handleSectionCompleted = useCallback((section: string, completed: number, total: number) => {
    logger.info("[GeneratingPage] Section completed", { section, completed, total, proposalId });
    addCompletedSection(section);
    // Calculate and set progress percentage
    const progress = total > 0 ? (completed / total) * 100 : 0;
    setProgressPercent(progress);
  }, [proposalId, addCompletedSection, setProgressPercent]);

  const handleProgress = useCallback((percent: number) => {
    setProgressPercent(percent);
  }, [setProgressPercent]);

  const handleError = useCallback((err: Error) => {
    logger.error("[GeneratingPage] Stream error", { error: err.message, proposalId });
    setError(err.message);
    // If the SSE endpoint is unavailable (fatal error), mark status as failed
    // so the error UI renders instead of the infinite connecting spinner
    if (err.message.includes("unavailable") || err.message.includes("rejected")) {
      setStatus("failed");
    }
  }, [proposalId, setError, setStatus]);

  // SSE streaming hook
  const { disconnect, isConnected: sseConnected, error: sseError } = useProposalGenerationStream({
    proposalId,
    enabled: mounted && !isNaN(proposalId),
    onConnected: (data: { selectedSections: string[]; totalSections: number; proposalStatus: string }) => {
      logger.info("[GeneratingPage] SSE connected", { proposalId, ...data });
      setConnectionState(true, false);
      // Populate section list from connected event metadata
      if (data.selectedSections.length > 0) {
        setSelectedSections(data.selectedSections);
      }
      if (data.totalSections > 0) {
        setTotalSections(data.totalSections);
      }
      // If proposal is already completed by the time we connect, navigate directly
      if (data.proposalStatus === "completed") {
        handleCompleted();
      }
    },
    onStageChanged: handleStageChanged,
    onSectionStarted: handleSectionStarted,
    onSectionCompleted: handleSectionCompleted,
    onProgress: handleProgress,
    onCompleted: handleCompleted,
    onFailed: handleFailed,
    onCancelled: handleCancelled,
    onError: handleError,
    onLegacy: (proposalStatus: string) => {
      // Legacy proposal without SSE streaming — navigate to proposal view
      // if it's already completed, otherwise show a message
      logger.info("[GeneratingPage] Legacy proposal detected", { proposalId, proposalStatus });
      if (proposalStatus === "completed") {
        router.push(`/proposal/${proposalId}`);
      } else {
        // Proposal is still generating but without SSE support.
        // Show a simplified waiting state and poll.
        setError("This proposal was created before real-time streaming was enabled. Please wait...");
        setStatus("queued");
      }
    },
  });

  const handleCancel = useCallback(async () => {
    logger.info("[GeneratingPage] Cancelling generation", { proposalId });
    disconnect();
    
    try {
      await cancelProposal(proposalId);
      setIsGenerating(false);
      router.push("/review");
    } catch (err) {
      logger.error("[GeneratingPage] Failed to cancel generation", err);
      setError("Failed to cancel generation");
    }
  }, [proposalId, disconnect, setIsGenerating, router, setError]);

  // Error state
  if (error && status === "failed") {
    return (
      <div className="generating-page">
        <div className="generating-container">
          <div className="generating-error-state">
            <div className="generating-error-icon">✗</div>
            <h2 className="generating-error-title">Generation Failed</h2>
            <p className="generating-error-desc">{error}</p>
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
                  resetGenerationState();
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

  // Connecting state
  if (!mounted || isConnecting) {
    return (
      <div className="generating-page">
        <div className="generating-container">
          <h1 className="generating-main-title">Connecting to Generation Stream...</h1>
          <p className="generating-main-subtitle">
            Establishing real-time connection to track progress.
          </p>
          <CircularProgress progress={0} size={240} strokeWidth={8} label="Connecting..." />
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
            <div className="generating-time-value">30-45 seconds</div>
            {isConnected && (
              <div className="generating-connection-badge">
                ✓ Connected via SSE
              </div>
            )}
          </div>

          {/* Right side - Build Sequence */}
          <div className="generating-sequence-section">
            <div className="generating-sequence-header">
              GENERATING SECTIONS ({completedSections}/{totalSections})
            </div>
            <ul className="generating-sequence-list">
              {selectedSections.length > 0 ? (
                selectedSections.map((section) => {
                  const isDone = completedSectionKeys.includes(section);
                  const isActive = currentSection === section;
                  return (
                    <li
                      key={section}
                      className={`generating-sequence-item${isDone ? " done" : ""}${isActive ? " active" : ""}`}
                    >
                      <span className="generating-sequence-icon">
                        {isDone ? "✓" : isActive ? "◐" : "○"}
                      </span>
                      <span className="generating-sequence-text">
                        {section}
                        {isActive && <span className="generating-sequence-status"> - Generating...</span>}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="generating-sequence-item">
                  <span className="generating-sequence-icon">○</span>
                  <span className="generating-sequence-text">Loading sections...</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <button
          onClick={handleCancel}
          className="generating-cancel-btn"
        >
          Cancel Generation
        </button>
      </div>
    </div>
  );
}
