"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelProposal, getProposal } from "@/services/proposal.service";
import { GENERATION_STEPS, DRAFTS_STORAGE_KEY } from "@/constants";
import { useWizardActions } from "@/store/features/wizard/proposalWizardSlice";
import { logger } from "@/utils/logger";
import { useProposalStatusStream } from "@/hooks/useProposalStatusStream";
import Button from "@/components/common/Button";
import CircularProgress from "@/components/common/CircularProgress";

export default function GeneratingPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const proposalId = Number(params.id);
  console.log("[GeneratingPage] Component mounted at", new Date().toISOString(), "proposalId:", proposalId, "params.id:", params.id);

  const { setIsGenerating, resetProposal } = useWizardActions();

  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [totalSections, setTotalSections] = useState<number>(0);
  const [completedSections, setCompletedSections] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  // Tracks whether the proposal finished normally — prevents cancel call on
  // the successful redirect to the proposal page.
  const completedRef = useRef<boolean>(false);

  const handleCompleted = useCallback(async () => {
    console.log("[GeneratingPage] handleCompleted called - navigating to web view for proposal:", proposalId);
    completedRef.current = true;
    setIsGenerating(false);

    // Clean up sessionStorage
    sessionStorage.removeItem("pending_proposal_id");
    sessionStorage.removeItem("generation_status");

    // Fetch the full proposal and save as draft
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
  }, [proposalId, router, setIsGenerating]);

  console.log("[GeneratingPage] About to call useProposalStatusStream with proposalId:", proposalId, "Type:", typeof proposalId, "Is NaN:", isNaN(proposalId));

  const {
    status,
    errorMessage,
    isPolling,
    pollCount,
    stop: stopStream,
  } = useProposalStatusStream({
    proposalId,
    disableTabSync: true,
    onStatusUpdate: (data) => {
      console.log("[GeneratingPage] Status update received:", {
        timestamp: new Date().toISOString(),
        status: data.status,
        currentStage: data.currentStage,
        generatingSection: data.generatingSection,
        completedSections: data.completedSections,
        completedSectionsCount: data.completedSections.length,
        selectedSections: data.selectedSections,
        selectedSectionsCount: data.selectedSections?.length,
        totalSections: data.totalSections,
        progressPercent: data.progressPercent,
      });
      setGeneratingSection(data.generatingSection ?? null);
      setCurrentStage(data.currentStage ?? null);
      setTotalSections(data.totalSections);
      setCompletedSections(data.completedSections.length);
      console.log("[GeneratingPage] Local state updated:", {
        generatingSection: data.generatingSection ?? null,
        currentStage: data.currentStage ?? null,
        totalSections: data.totalSections,
        completedSections: data.completedSections.length,
      });
    },
    onCompleted: () => {
      console.log("[GeneratingPage] Generation completed");
      void handleCompleted();
    },
    onFailed: () => {
      console.log("[GeneratingPage] Generation failed");
      completedRef.current = true;
    },
    onCancelled: () => {
      console.log("[GeneratingPage] Generation cancelled");
      completedRef.current = true;
      setIsGenerating(false);
      router.push("/review");
    },
  });

  // Use backend's progressPercent directly for accurate real-time progress
  const progressPercent = status?.progressPercent ?? 0;

  console.log("[GeneratingPage] Render state:", {
    timestamp: new Date().toISOString(),
    status: status?.status,
    progressPercent,
    totalSections,
    completedSections,
    currentStage,
    generatingSection,
    isPolling,
    pollCount,
    hasStatus: !!status,
  });

  // Map current stage to step index for accurate progress display
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
        return 0;
      case "validating":
        return 1;
      case "generating":
        const progressRatio = progressPercent / 100;
        if (progressRatio < 0.33) return 2;
        if (progressRatio < 0.90) return 3;
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
            <div className="generating-sequence-header">
              GENERATING SECTIONS ({completedSections}/{totalSections})
            </div>
            <ul className="generating-sequence-list">
              {status?.selectedSections?.map((section, index) => {
                const isDone = status?.completedSections?.includes(section);
                const isActive = status?.generatingSection === section;
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
              }) || (
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
