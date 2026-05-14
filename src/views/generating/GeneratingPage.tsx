"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelProposal, getProposal } from "@/services/proposal.service";
import { GENERATION_STEPS, DRAFTS_STORAGE_KEY } from "@/constants";
import { useProposalWizard } from "@/context/ProposalContext";
import { logger } from "@/utils/logger";
import { useProposalStatusStream } from "@/hooks/useProposalStatusStream";
import Button from "@/components/common/Button";
import CircularProgress from "@/components/common/CircularProgress";

export default function GeneratingPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const proposalId = Number(params.id);
  const { setIsGenerating, resetProposal } = useProposalWizard();

  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [totalSections, setTotalSections] = useState<number>(0);
  const [completedSections, setCompletedSections] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  // Tracks whether the proposal finished normally — prevents cancel call on
  // the successful redirect to the proposal page.
  const completedRef = useRef<boolean>(false);

  const handleCompleted = useCallback(async () => {
    completedRef.current = true;
    setIsGenerating(false);

    // Clean up sessionStorage
    sessionStorage.removeItem("pending_proposal_id");
    sessionStorage.removeItem("generation_status");

    // Fetch the full proposal and save as draft
    try {
      const proposalData = await getProposal(proposalId);

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
    } catch (error) {
      logger.error("Failed to save draft:", error);
    }

    router.push(`/proposal/${proposalId}`);
  }, [proposalId, router, setIsGenerating]);

  const {
    status,
    errorMessage,
    isPolling,
    pollCount,
    stop: stopStream,
  } = useProposalStatusStream({
    proposalId,
    onStatusUpdate: (data) => {
      console.log("[GeneratingPage] Status update:", {
        status: data.status,
        currentStage: data.currentStage,
        generatingSection: data.generatingSection,
        completedSections: data.completedSections,
        selectedSections: data.selectedSections,
      });
      setGeneratingSection(data.generatingSection ?? null);
      setCurrentStage(data.currentStage ?? null);
      const total = data.selectedSections?.length ?? 0;
      const completed = data.completedSections.length;
      setTotalSections(total);
      setCompletedSections(completed);
    },
    onCompleted: () => {
      void handleCompleted();
    },
    onFailed: () => {
      completedRef.current = true;
    },
    onCancelled: () => {
      completedRef.current = true;
      setIsGenerating(false);
      router.push("/review");
    },
  });

  // Drive progress from real backend section completion ratio
  const sectionRatio = totalSections > 0 ? completedSections / totalSections : 0;
  const progressPercent = Math.min(Math.round(sectionRatio * 90) + 5, 90);

  console.log("[GeneratingPage] Progress calculation:", {
    totalSections,
    completedSections,
    sectionRatio,
    progressPercent,
    currentStage,
    generatingSection,
  });

  // Map current stage to step index for accurate progress display
  const getActiveStepIndex = (): number => {
    if (!currentStage) {
      if (sectionRatio < 0.05) return 0;
      if (sectionRatio < 0.20) return 1;
      if (sectionRatio < 0.85) return 2;
      if (sectionRatio < 0.97) return 3;
      return GENERATION_STEPS.length - 1;
    }

    switch (currentStage) {
      case "parsing":
        return 0;
      case "validating":
        return 1;
      case "generating":
        if (sectionRatio < 0.33) return 2;
        if (sectionRatio < 0.90) return 3;
        return 4;
      case "finalizing":
        return 5;
      default:
        return 0;
    }
  };

  const activeStepIndex = getActiveStepIndex();

  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (progressPercent / 100) * circumference;

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
            <div className="generating-time-value">30-45 seconds</div>
            {isPolling && (
              <div className="generating-poll-badge">
                Polling ({pollCount}/{120})
              </div>
            )}
          </div>

          {/* Right side - Build Sequence */}
          <div className="generating-sequence-section">
            <div className="generating-sequence-header">BUILD SEQUENCE</div>
            <ul className="generating-sequence-list">
              {[
                "Analyzing source materials...",
                "Mapping strategic objectives...",
                "Generating executive summary...",
                "Drafting technical specifications...",
                "Polishing final document structure."
              ].map((step, index) => {
                const isDone = index < Math.floor(progressPercent / 20);
                const isActive = index === Math.floor(progressPercent / 20);
                return (
                  <li
                    key={index}
                    className={`generating-sequence-item${isDone ? " done" : ""}${isActive ? " active" : ""}`}
                  >
                    <span className="generating-sequence-icon">
                      {isDone ? "✓" : isActive ? "◐" : "○"}
                    </span>
                    <span className="generating-sequence-text">{step}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <Button
          variant="danger"
          size="md"
          onClick={async () => {
            completedRef.current = true;
            stopStream();
            await cancelProposal(proposalId).catch(() => undefined);
            setIsGenerating(false);
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
