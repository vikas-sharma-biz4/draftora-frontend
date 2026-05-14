"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import { generateProposal } from "@/services/proposal.service";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { useProposalWizardStore } from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { usePipelineActions } from "@/store/features/pipeline/pipelineSlice";

export default function GeneratingLoadingPage(): JSX.Element {
  const router = useRouter();
  const [checkCount, setCheckCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const isSubmittingRef = useRef<boolean>(false);
  const setGeneratedProposalId = useProposalWizardStore((state) => state.setGeneratedProposalId);
  const { markStepVisitedOnBackend } = usePipelineActions();
  const setDraftStage = useDraftSessionStore((state) => state.setDraftStage);

  useEffect(() => {
    const initiateGeneration = async () => {
      const pendingProposalDataStr = sessionStorage.getItem("pending_proposal_data");
      const status = sessionStorage.getItem("generation_status");

      // If we have pending proposal data and status is "initiating", call the API
      if (pendingProposalDataStr && status === "initiating") {
        if (isSubmittingRef.current) {
          logger.debug("[GeneratingLoadingPage] Generation already in progress, skipping duplicate call");
          return;
        }
        isSubmittingRef.current = true;

        try {
          const proposalData = JSON.parse(pendingProposalDataStr);
          logger.debug("[GeneratingLoadingPage] Initiating proposal generation with data:", {
            title: proposalData.title,
            clientId: proposalData.clientId,
            sectionsCount: proposalData.selectedSections?.length,
          });

          const result = await generateProposal(proposalData);
          logger.debug("[GeneratingLoadingPage] Proposal generation successful, ID:", result.id);

          setGeneratedProposalId(result.id);

          // Store the ID and update status
          sessionStorage.setItem("pending_proposal_id", result.id.toString());
          sessionStorage.setItem("generation_status", "started");

          // Mark Step 2 as visited when starting generation
          if (result.id) {
            await markStepVisitedOnBackend(result.id, 2);
          }

          // Set stage to generated
          setDraftStage("review_complete");

          // Redirect to the ID-based page for real-time polling
          router.push(`/generating/${result.id}`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to generate proposal.";
          logger.error("[GeneratingLoadingPage] Proposal generation failed:", err);
          setErrorMessage(message);
          sessionStorage.removeItem("pending_proposal_data");
          sessionStorage.removeItem("generation_status");
          toast.error(message);
          setTimeout(() => {
            router.push("/review");
          }, 2000);
        } finally {
          isSubmittingRef.current = false;
        }
        return;
      }

      // Check if ID is already available (for edge cases)
      const pendingProposalId = sessionStorage.getItem("pending_proposal_id");
      if (pendingProposalId && status === "started") {
        router.push(`/generating/${pendingProposalId}`);
        return;
      }

      // Keep checking every 200ms for up to 30 seconds
      if (checkCount < 150) {
        setTimeout(() => setCheckCount(c => c + 1), 200);
      }
    };

    initiateGeneration();
  }, [router, checkCount, setGeneratedProposalId, markStepVisitedOnBackend, setDraftStage]);

  const progressPercent = 0;

  if (errorMessage) {
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
                  router.push("/review");
                }}
              >
                ← Back to Review
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
            <div className="generating-circle-wrap">
              <svg
                width="240"
                height="240"
                viewBox="0 0 240 240"
                style={{ transform: "rotate(-90deg)" }}
                aria-hidden="true"
              >
                <circle
                  cx="120"
                  cy="120"
                  r="110"
                  fill="transparent"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                <circle
                  cx="120"
                  cy="120"
                  r="110"
                  fill="transparent"
                  stroke="#6366f1"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 110}
                  strokeDashoffset={2 * Math.PI * 110}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="generating-circle-content">
                <div className="generating-percentage">{progressPercent}%</div>
              </div>
            </div>
            <div className="generating-time-label">TIME REMAINING</div>
            <div className="generating-time-value">30-45 seconds</div>
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
                const isActive = index === 0;
                return (
                  <li
                    key={index}
                    className={`generating-sequence-item${isActive ? " active" : ""}`}
                  >
                    <span className="generating-sequence-icon">
                      {isActive ? "◐" : "○"}
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
          onClick={() => {
            sessionStorage.removeItem("pending_proposal_data");
            sessionStorage.removeItem("pending_proposal_id");
            sessionStorage.removeItem("generation_status");
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
