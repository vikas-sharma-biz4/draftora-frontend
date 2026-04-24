"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelProposal, getProposal, getProposalStatus } from "@/api/proposalApi";
import { GENERATION_STEPS } from "@/constants";
import { MAX_POLL_ATTEMPTS, POLLING_INTERVAL_MS } from "@/config/config";
import { useProposal } from "@/context/ProposalContext";

const DOC_TYPE_LABELS: Record<string, { short: string; full: string; next: string }> = {
  sow:          { short: "SOW",          full: "Statement of Work",                  next: "You'll review and approve the SOW to unlock your BRD" },
  brd:          { short: "BRD",          full: "Business Requirements Document",      next: "You'll review and approve the BRD to unlock your FRD" },
  frd:          { short: "FRD",          full: "Functional Requirements Document",    next: "You'll review and approve the FRD to unlock the Architecture Document" },
  architecture: { short: "Architecture", full: "Architecture Document",               next: "You'll review and finalize the Architecture Document" },
};

const AI_MESSAGES: Record<number, string[]> = {
  0: ["Validating your knowledge base…", "Checking proposal completeness…"],
  1: ["Synthesizing strategic context…", "Mapping business goals to document structure…", "Identifying key stakeholders from your proposal…"],
  2: ["Writing content section by section…", "Applying industry-standard formatting…", "Aligning requirements with proposal scope…"],
  3: ["Putting the final touches on your document…", "Almost there — reviewing for consistency…"],
};

function inferDocType(title: string): string {
  const t = title.toLowerCase();
  if (t.startsWith("brd")) return "brd";
  if (t.startsWith("frd")) return "frd";
  if (t.startsWith("sow")) return "sow";
  if (t.startsWith("arch")) return "architecture";
  return "";
}

export default function GeneratingPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const proposalId = params.id ? Number(params.id) : NaN;
  const { setIsGenerating, resetProposal } = useProposal();

  const [pollCount, setPollCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>(isNaN(proposalId) ? "Invalid proposal ID. Please check the URL." : "");
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [totalSections, setTotalSections] = useState<number>(0);
  const [completedSections, setCompletedSections] = useState<number>(0);
  const [docType, setDocType] = useState<string>("");
  const [parentProposalId, setParentProposalId] = useState<string | null>(null);
  const [aiMessageIdx, setAiMessageIdx] = useState<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef<number>(0);
  const aiMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef<boolean>(false);

  // Drive progress from real backend section completion ratio
  const sectionRatio = totalSections > 0 ? completedSections / totalSections : 0;
  const progressPercent = Math.min(Math.round(sectionRatio * 90) + 5, 90);

  const activeStepIndex =
    sectionRatio < 0.05 ? 0
    : sectionRatio < 0.20 ? 1
    : sectionRatio < 0.85 ? 2
    : sectionRatio < 0.97 ? 3
    : GENERATION_STEPS.length - 1;

  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const docInfo = DOC_TYPE_LABELS[docType] ?? { short: "Document", full: "Document", next: "You'll be able to review your document shortly" };

  // Rotate AI messages every 4s within the current step
  useEffect(() => {
    const msgs = AI_MESSAGES[activeStepIndex] ?? [];
    if (msgs.length <= 1) return;
    const cycle = () => {
      setAiMessageIdx(i => (i + 1) % msgs.length);
      aiMsgTimerRef.current = setTimeout(cycle, 4000);
    };
    setAiMessageIdx(0);
    aiMsgTimerRef.current = setTimeout(cycle, 4000);
    return () => { if (aiMsgTimerRef.current) clearTimeout(aiMsgTimerRef.current); };
  }, [activeStepIndex]);

  // One-time fetch to infer doc type + read parent from localStorage
  useEffect(() => {
    if (isNaN(proposalId)) return;
    const parent = localStorage.getItem(`draftora_fp_parent_${proposalId}`);
    setParentProposalId(parent);
    getProposal(proposalId).then(p => {
      const type = inferDocType(p.title ?? "");
      if (type) setDocType(type);
    }).catch(() => undefined);
  }, [proposalId]);

  const fetchAndPoll = useCallback(async (): Promise<void> => {
    if (isNaN(proposalId)) {
      setErrorMessage("Invalid proposal ID. Please check the URL.");
      return;
    }

    try {
      const data = await getProposalStatus(proposalId);

      if (data.status === "completed") {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        completedRef.current = true;
        setIsGenerating(false);
        await getProposal(proposalId).catch(() => undefined);
        // Return to pipeline if this is a follow-up document
        const parent = localStorage.getItem(`draftora_fp_parent_${proposalId}`);
        if (parent) {
          router.push(`/proposal/${parent}/followup`);
        } else {
          router.push(`/proposal/${proposalId}`);
        }
        return;
      }

      if (data.status === "cancelled") {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        completedRef.current = true;
        setIsGenerating(false);
        const parent = localStorage.getItem(`draftora_fp_parent_${proposalId}`);
        router.push(parent ? `/proposal/${parent}/followup` : "/review");
        return;
      }

      if (data.status === "failed") {
        setErrorMessage("Document generation failed. Please go back and try again.");
        return;
      }

      setGeneratingSection(data.generatingSection ?? null);
      const total = data.selectedSections?.length ?? 0;
      const completed = data.completedSections.length;
      setTotalSections(total);
      setCompletedSections(completed);

      pollCountRef.current += 1;
      setPollCount(pollCountRef.current);

      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        setErrorMessage("Generation is taking longer than expected. Please check back in a moment or try again.");
        return;
      }

      pollTimerRef.current = setTimeout(fetchAndPoll, POLLING_INTERVAL_MS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to track document generation.";
      setErrorMessage(message);
    }
  }, [proposalId, router]);

  useEffect(() => {
    fetchAndPoll();
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, [fetchAndPoll, proposalId]);

  const currentAiMsg = (AI_MESSAGES[activeStepIndex] ?? ["Processing…"])[aiMessageIdx % (AI_MESSAGES[activeStepIndex]?.length ?? 1)];

  if (errorMessage) {
    completedRef.current = true;
    return (
      <div className="generating-page">
        <div className="generating-orb generating-orb-1" />
        <div className="generating-orb generating-orb-2" />
        <div className="generating-error-state">
          <div className="generating-error-icon">✗</div>
          <h2 className="generating-error-title">Generation Failed</h2>
          <p className="generating-error-desc">{errorMessage}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setIsGenerating(false);
                const parent = localStorage.getItem(`draftora_fp_parent_${proposalId}`);
                router.push(parent ? `/proposal/${parent}/followup` : "/review");
              }}
            >
              ← Back to Pipeline
            </button>
            <button className="btn btn-ghost" onClick={() => { resetProposal(); router.push("/"); }}>
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="generating-page">
      <div className="generating-orb generating-orb-1" />
      <div className="generating-orb generating-orb-2" />

      <div className="generating-center">
        {/* Circular SVG progress ring */}
        <div className="generating-circle-wrap">
          <svg width="192" height="192" viewBox="0 0 192 192" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
            <circle cx="96" cy="96" r={radius} fill="transparent" stroke="var(--color-border)" strokeWidth="6" />
            <circle cx="96" cy="96" r={radius} fill="transparent" stroke="var(--color-primary)" strokeWidth="6"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s ease" }} />
          </svg>
          <div className="generating-circle-inner">
            <div className="generating-circle-icon">✦</div>
            <div className="generating-circle-pct">{progressPercent}%</div>
          </div>
        </div>

        {/* Headlines */}
        <h1 className="generating-title">
          {`We're building your `}
          <span className="generating-title-accent">{docInfo.full}…</span>
        </h1>

        <p className="generating-subtitle">
          {generatingSection
            ? `Writing section: "${generatingSection.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}"${totalSections > 0 ? ` (${completedSections + 1} of ${totalSections})` : ""}`
            : currentAiMsg}
        </p>

        {/* AI reasoning log */}
        <div className="generating-log">
          <div className="generating-log-header">
            <span className="generating-log-label">AI Processing</span>
            <span className="spinner" style={{ width: 12, height: 12 }} aria-label="Loading" />
          </div>
          <ul className="generating-log-steps" role="list">
            {GENERATION_STEPS.map((step, index) => {
              const isDone = index < activeStepIndex;
              const isActive = index === activeStepIndex;
              return (
                <li key={step.id} className={`generating-log-step${isDone ? " done" : ""}${isActive ? " active" : ""}`}>
                  <span className="generating-log-step-icon" aria-hidden="true">
                    {isDone ? "✓" : isActive ? "›" : "○"}
                  </span>
                  <span className="generating-log-step-label">{step.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* What's next */}
        <p style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)", marginTop: 8, textAlign: "center", maxWidth: 340 }}>
          <strong>Next:</strong> {docInfo.next}
        </p>

        {/* Cancel */}
        <button
          className="generating-cancel"
          onClick={async () => {
            completedRef.current = true;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            await cancelProposal(proposalId).catch(() => undefined);
            setIsGenerating(false);
            const parent = localStorage.getItem(`draftora_fp_parent_${proposalId}`);
            router.push(parent ? `/proposal/${parent}/followup` : "/review");
          }}
          type="button"
        >
          <span aria-hidden="true">✕</span> Stop &amp; go back
        </button>
      </div>
    </div>
  );
}
