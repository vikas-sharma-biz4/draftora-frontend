"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelProposal, getProposal, getProposalStatus } from "@/api/proposalApi";
import { GENERATION_STEPS, DRAFTS_STORAGE_KEY } from "@/constants";
import { MAX_POLL_ATTEMPTS, POLLING_INTERVAL_MS } from "@/config/config";
import { useProposal } from "@/context/ProposalContext";

export default function GeneratingPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const proposalId = Number(params.id);
  const { setIsGenerating, resetProposal } = useProposal();

  const [pollCount, setPollCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [totalSections, setTotalSections] = useState<number>(0);
  const [completedSections, setCompletedSections] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef<number>(0);
  // Tracks whether the proposal finished normally — prevents cancel call on
  // the successful redirect to the proposal page.
  const completedRef = useRef<boolean>(false);

  // Drive progress from real backend section completion ratio
  const sectionRatio = totalSections > 0 ? completedSections / totalSections : 0;
  const progressPercent = Math.min(Math.round(sectionRatio * 90) + 5, 90);

  // Map current stage to step index for accurate progress display
  const getActiveStepIndex = (): number => {
    if (!currentStage) {
      // Fallback to section ratio if no stage is set
      if (sectionRatio < 0.05) return 0;
      if (sectionRatio < 0.20) return 1;
      if (sectionRatio < 0.85) return 2;
      if (sectionRatio < 0.97) return 3;
      return GENERATION_STEPS.length - 1;
    }
    
    // Map backend stage to frontend step index
    switch (currentStage) {
      case "parsing":
        return 0;
      case "validating":
        return 1;
      case "generating":
        // During generation, use section progress for more granular tracking
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

  const fetchAndPoll = useCallback(async (): Promise<void> => {
    try {
      // Use the lightweight /status/ endpoint during polling — no section content
      const data = await getProposalStatus(proposalId);

      if (data.status === "completed") {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        completedRef.current = true;
        setIsGenerating(false); // reset so review page button is clean if user goes back
        
        // Fetch the full proposal and save as draft
        try {
          const proposalData = await getProposal(proposalId);
          
          // Auto-save to drafts
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
          
          const drafts = JSON.parse(localStorage.getItem(DRAFTS_STORAGE_KEY) || "[]");
          const existingIndex = drafts.findIndex((d: any) => d.id === draftItem.id);
          
          if (existingIndex >= 0) {
            drafts[existingIndex] = draftItem;
          } else {
            drafts.unshift(draftItem);
          }
          
          localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
        } catch (error) {
          console.error("Failed to save draft:", error);
        }
        
        router.push(`/proposal/${proposalId}`);
        return;
      }

      if (data.status === "cancelled") {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        completedRef.current = true;
        setIsGenerating(false);
        router.push("/review");
        return;
      }

      if (data.status === "failed") {
        setErrorMessage(
          "Proposal generation failed. Please go back and try again."
        );
        return;
      }

      // Update live section progress and current stage
      setGeneratingSection(data.generatingSection ?? null);
      setCurrentStage(data.currentStage ?? null);
      const total = data.selectedSections?.length ?? 0;
      const completed = data.completedSections.length;
      setTotalSections(total);
      setCompletedSections(completed);

      pollCountRef.current += 1;
      setPollCount(pollCountRef.current);

      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        setErrorMessage(
          "Generation is taking longer than expected. Please check back in a moment or try again."
        );
        return;
      }

      pollTimerRef.current = setTimeout(fetchAndPoll, POLLING_INTERVAL_MS);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to track proposal generation.";
      setErrorMessage(message);
    }
  }, [proposalId, router]);

  useEffect(() => {
    fetchAndPoll();
    return () => {
      // Only stop the polling timer on unmount.
      // Do NOT auto-cancel — backend generation continues if user navigates away.
      // Cancel only happens via the explicit "Cancel Generation" button.
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchAndPoll, proposalId]);

  if (errorMessage) {
    // Generation already stopped (failed/timeout) — no need to cancel on unmount
    completedRef.current = true;
    return (
      <div className="generating-page">
        <div className="generating-orb generating-orb-1" />
        <div className="generating-orb generating-orb-2" />
        <div className="generating-error-state">
          <div className="generating-error-icon">✗</div>
          <h2 className="generating-error-title">Generation Failed</h2>
          <p className="generating-error-desc">{errorMessage}</p>
          <div
            style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}
          >
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
    );
  }

  return (
    <div className="generating-page">
      {/* Ambient depth orbs */}
      <div className="generating-orb generating-orb-1" />
      <div className="generating-orb generating-orb-2" />

      <div className="generating-center">
        {/* Circular SVG progress ring */}
        <div className="generating-circle-wrap">
          <svg
            width="192"
            height="192"
            viewBox="0 0 192 192"
            style={{ transform: "rotate(-90deg)" }}
            aria-hidden="true"
          >
            {/* Track */}
            <circle
              cx="96"
              cy="96"
              r={radius}
              fill="transparent"
              stroke="var(--color-border)"
              strokeWidth="6"
            />
            {/* Progress fill */}
            <circle
              cx="96"
              cy="96"
              r={radius}
              fill="transparent"
              stroke="var(--color-primary)"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div className="generating-circle-inner">
            <div className="generating-circle-icon">✦</div>
            <div className="generating-circle-pct">{progressPercent}%</div>
          </div>
        </div>

        {/* Headlines */}
        <h1 className="generating-title">
          Architecting your{" "}
          <span className="generating-title-accent">proposal...</span>
        </h1>
        <p className="generating-subtitle">
          {currentStage === "parsing"
            ? "Parsing and extracting text from uploaded documents..."
            : currentStage === "validating"
            ? "Validating knowledge base and preparing context..."
            : generatingSection
            ? `Writing section: "${generatingSection.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}"${totalSections > 0 ? ` (${completedSections + 1} of ${totalSections})` : ""}`
            : "Our AI engine is synthesizing your inputs and structuring the document. This usually takes 30–60 seconds."}
        </p>

        {/* AI reasoning log */}
        <div className="generating-log">
          <div className="generating-log-header">
            <span className="generating-log-label">AI Processing</span>
            <span
              className="spinner"
              style={{ width: 12, height: 12 }}
              aria-label="Loading"
            />
          </div>
          <ul className="generating-log-steps" role="list">
            {GENERATION_STEPS.map((step, index) => {
              const isDone = index < activeStepIndex;
              const isActive = index === activeStepIndex;
              return (
                <li
                  key={step.id}
                  className={`generating-log-step${isDone ? " done" : ""}${isActive ? " active" : ""}`}
                >
                  <span className="generating-log-step-icon" aria-hidden="true">
                    {isDone ? "✓" : isActive ? "›" : "○"}
                  </span>
                  <span className="generating-log-step-label">{step.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Cancel */}
        <button
          className="generating-cancel"
          onClick={async () => {
            completedRef.current = true;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            await cancelProposal(proposalId).catch(() => undefined);
            setIsGenerating(false);
            router.push("/review");
          }}
          type="button"
        >
          <span aria-hidden="true">✕</span> Cancel Generation
        </button>
      </div>
    </div>
  );
}
