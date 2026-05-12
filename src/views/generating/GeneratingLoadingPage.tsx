"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GENERATION_STEPS } from "@/constants";
import Button from "@/components/common/Button";

export default function GeneratingLoadingPage(): JSX.Element {
  const router = useRouter();
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    const checkForId = () => {
      const pendingProposalId = sessionStorage.getItem("pending_proposal_id");
      const status = sessionStorage.getItem("generation_status");
      
      if (pendingProposalId && status === "started") {
        // API call completed, redirect to the ID-based page for real-time polling
        router.push(`/generating/${pendingProposalId}`);
        return;
      }
      
      // Keep checking every 200ms for up to 30 seconds
      if (checkCount < 150) {
        setTimeout(() => setCheckCount(c => c + 1), 200);
      }
    };

    checkForId();
  }, [router, checkCount]);

  const progressPercent = 0;

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
            sessionStorage.removeItem("pending_proposal_id");
            sessionStorage.removeItem("generation_status");
            window.location.href = "/review";
          }}
          className="generating-cancel-btn"
        >
          Cancel Generation
        </Button>
      </div>
    </div>
  );
}
