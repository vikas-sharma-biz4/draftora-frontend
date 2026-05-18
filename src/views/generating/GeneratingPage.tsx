"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cancelProposal } from "@/services/proposal.service";
import { useWizardActions } from "@/store/features/wizard/proposalWizardSlice";
import { logger } from "@/utils/logger";
import { useProposalGenerationStream } from "@/hooks/useProposalGenerationStream";
import { useGenerationStore } from "@/store/features/generation/generationSlice";
import CircularProgress from "@/components/common/CircularProgress";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps generation status to a 0-based active step index:
 *   0 = Analysing Source Materials
 *   1 = Building Context
 *   2 = Generating Sections
 *   3 = Final Review
 *   4 = All done (sentinel)
 */
function deriveActiveStep(
  status: string,
  completedSections: number,
  totalSections: number,
): number {
  if (status === "completed" || status === "cancelled") return 4;
  if (status === "finalizing" || (totalSections > 0 && completedSections >= totalSections)) return 3;
  if (status === "generating" || status === "refining") return 2;
  if (status === "planning") return 1;
  return 0;
}

function estimateTimeRemaining(percent: number): string {
  if (percent >= 97) return "Almost done...";
  if (percent >= 85) return "10–20 seconds";
  if (percent >= 60) return "30–45 seconds";
  if (percent >= 30) return "1–2 minutes";
  return "2–3 minutes";
}

export default function GeneratingPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const proposalId = Number(params.id);

  const { setIsGenerating, resetProposal } = useWizardActions();

  // Zustand store for generation state
  const {
    status,
    progressPercent,
    totalSections,
    completedSections,
    isConnecting,
    error,
    setProposalId,
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
    // Reset generation state to start fresh
    resetGenerationState();
    setMounted(true);
    setProposalId(proposalId);
    setStartedAt(new Date().toISOString());
  }, [proposalId, setProposalId, setStartedAt, resetGenerationState]);

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

  // ── Build Sequence derivation ──────────────────────────────────────────────
  const activeStep = deriveActiveStep(status, completedSections, totalSections);
  const isAllDone = activeStep === 4;

  const buildSteps = [
    { label: "Analysing Source Materials" },
    { label: "Building Context" },
    {
      label: totalSections > 0
        ? `Generating Sections (${completedSections} / ${totalSections})`
        : "Generating Sections",
    },
    { label: "Final Review" },
  ];

  const displayProgress = isAllDone ? 100 : progressPercent;

  return (
    <div className="generating-page">
      <div className="generating-container">
        <h1 className="generating-main-title">Architecting Your Proposal...</h1>
        <p className="generating-main-subtitle">
          The AI is weaving together your context, source materials, and
          parameters into a production-grade document.
        </p>

        <div className="generating-content">
          {/* Left — Circular Progress */}
          <div className="generating-progress-section">
            <CircularProgress
              progress={displayProgress}
              size={200}
              strokeWidth={6}
              label={`${Math.round(displayProgress)}%`}
            />
            <div className="generating-time-label">TIME REMAINING</div>
            <div className="generating-time-value">
              {isAllDone ? "Done!" : estimateTimeRemaining(displayProgress)}
            </div>
          </div>

          {/* Right — Build Sequence */}
          <div className="generating-sequence-section">
            <div className="generating-sequence-header">BUILD SEQUENCE</div>
            <ul className="generating-sequence-list">
              {buildSteps.map((step, idx) => {
                const isDone = isAllDone || idx < activeStep;
                const isActive = !isAllDone && idx === activeStep;
                const isPending = !isAllDone && idx > activeStep;

                return (
                  <li
                    key={idx}
                    className={`generating-sequence-item${isDone ? " done" : ""}${isActive ? " active" : ""}${isPending ? " pending" : ""}`}
                  >
                    <span className="generating-sequence-icon">
                      {isDone ? (
                        <svg viewBox="0 0 24 24" fill="currentColor" width={20} height={20}>
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                      ) : isActive ? (
                        <svg className="gen-spinner" viewBox="0 0 24 24" fill="none" width={20} height={20}>
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.25 }} />
                          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" style={{ opacity: 0.85 }} />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
                          <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                    </span>
                    <span className="generating-sequence-text">{step.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <button onClick={handleCancel} className="generating-cancel-btn">
          Cancel Generation
        </button>
      </div>
    </div>
  );
}
