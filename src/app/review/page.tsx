"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import styles from "./page.module.scss";

import { generateProposal } from "@/api/proposalApi";
import { SECTION_DISPLAY_NAMES } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { formatBytes } from "@/utils/formatBytes";

const Sidebar = dynamic(() => import("@/components/common/Sidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

export default function ReviewPage(): JSX.Element {
  const {
    proposalData,
    setCurrentStep,
    isGenerating,
    setIsGenerating,
    setGeneratedProposalId,
  } = useProposal();
  const router = useRouter();
  const handleSaveDraft = useSaveDraft();
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Reset isGenerating when landing on review page
  useEffect(() => {
    setIsGenerating(false);
  }, [setIsGenerating]);

  function handleEditStep(step: number, path: string): void {
    setCurrentStep(step as 1 | 2 | 3 | 4 | 5);
    router.push(path);
  }

  async function handleGenerate(): Promise<void> {
    setIsGenerating(true);
    setErrorMessage("");
    
    // Show immediate feedback to user
    toast.info("Starting proposal generation...");
    
    try {
      const result = await generateProposal(proposalData);
      setGeneratedProposalId(result.id);
      
      // Navigate to progress screen immediately
      router.push(`/generating/${result.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate proposal.";
      setErrorMessage(message);
      setIsGenerating(false);
      toast.error(message);
    }
  }

  const descriptionSnippet = proposalData.description
    ? proposalData.description.slice(0, 120) +
      (proposalData.description.length > 120 ? "..." : "")
    : "No description provided.";

  const selectedSectionLabels = proposalData.selectedSections.map(
    (key) =>
      (proposalData.sectionDisplayNames ?? {})[key] ??
      SECTION_DISPLAY_NAMES[key] ??
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );

  const estimatedPages = `${proposalData.selectedSections.length * 2}–${proposalData.selectedSections.length * 3} Pages`;

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content">
        <div className="page-badge">Phase 05</div>
        <h1 className="page-title">Final Review</h1>
        <p className="page-subtitle">
          Verify your proposal configuration before the AI architect constructs
          your final document. Everything looks right? Hit Generate.
        </p>

        {errorMessage && (
          <div className={styles.errorAlert}>
            {errorMessage}
          </div>
        )}

        <div className="review-layout">
          {/* Left — Summary Cards */}
          <div>
            {/* Step 1 */}
            <div className="review-card">
              <div className="review-card-header">
                <span className="review-card-title">Step 1 — Scope</span>
                <button
                  className="link-plain"
                  onClick={() => handleEditStep(1, "/")}
                >
                  Edit
                </button>
              </div>
              <div className="review-field">
                <span className="review-field-label">Proposal Title</span>
                <span className="review-field-value">
                  {proposalData.title || "—"}
                </span>
              </div>
              <div className="review-field">
                <span className="review-field-label">Client Name</span>
                <span className="review-field-value">
                  {proposalData.clientName || "—"}
                </span>
              </div>
              <div className="review-field">
                <span className="review-field-label">Strategic Prompt Snippet</span>
                <span className="review-field-value muted">
                  "{descriptionSnippet}"
                </span>
              </div>
            </div>

            {/* Step 2 + Step 3 side by side */}
            <div className="grid-2">
              <div className="review-card">
                <div className="review-card-header">
                  <span className="review-card-title">Step 2 — Knowledge Base</span>
                  <button
                    className="link-plain"
                    onClick={() => handleEditStep(2, "/knowledge-base")}
                  >
                    Edit
                  </button>
                </div>
                {proposalData.filesMeta.length > 0 ? (
                  <ul className={styles.fileList}>
                    {proposalData.filesMeta.map((f, i) => (
                      <li key={i} className={styles.fileItem}>
                        <span className={styles.fileItemName}>{f.name}</span>
                        <span className={styles.fileItemSize}>
                          {formatBytes(f.size)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted text-small">
                    No files uploaded
                  </span>
                )}
                {proposalData.webReferences.length > 0 && (
                  <div className={styles.webRefsSection}>
                    <span className={`review-field-label ${styles.webRefsLabel}`}>
                      Web References
                    </span>
                    {proposalData.webReferences.map((r) => (
                      <div key={r} className={styles.webRefUrl}>{r}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="review-card">
                <div className="review-card-header">
                  <span className="review-card-title">Step 4 — Style &amp; Voice</span>
                  <button
                    className="link-plain"
                    onClick={() => handleEditStep(4, "/parameters")}
                  >
                    Edit
                  </button>
                </div>
                <div className={`flex-row ${styles.badgeRow}`}>
                  <span className="badge badge-primary">{proposalData.tone}</span>
                  <span className="badge badge-muted">
                    {proposalData.lengthPreference}
                  </span>
                  <span className="badge badge-muted">{proposalData.language}</span>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="review-card">
              <div className="review-card-header">
                <span className="review-card-title">
                  Included Sections ({proposalData.selectedSections.length})
                </span>
                <button
                  className="link-plain"
                  onClick={() => handleEditStep(4, "/parameters")}
                >
                  Edit
                </button>
              </div>
              <div className={`flex-row ${styles.sectionsBadgeRow}`}>
                {selectedSectionLabels.map((label) => (
                  <span key={label} className="badge badge-primary">
                    {label}
                  </span>
                ))}
                {selectedSectionLabels.length === 0 && (
                  <span className="text-muted text-small">
                    No sections selected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right — Launch Panel */}
          <div className="launch-panel">
            <h2 className="launch-panel-title">Ready to launch?</h2>
            <p className="launch-panel-desc">
              Your proposal configuration is complete. The AI will now generate
              each section based on your inputs. This may take 30–60 seconds.
            </p>

            <button
              className="launch-btn"
              onClick={handleGenerate}
              disabled={isGenerating || proposalData.selectedSections.length === 0}
            >
              {isGenerating ? (
                <>
                  <span className={`spinner spinner-white ${styles.spinnerSm}`} />
                  Generating...
                </>
              ) : (
                "✦ Generate Proposal"
              )}
            </button>

            <button
              className="launch-btn-secondary"
              onClick={handleSaveDraft}
              disabled={isGenerating}
            >
              Save Draft for Later
            </button>

            <div className="launch-stats">
              <div className="launch-stats-title">Summary Stats</div>
              <div className="launch-stat-item">
                <span className="launch-stat-label">Estimated Length</span>
                <span className="launch-stat-value">{estimatedPages}</span>
              </div>
              <div className="launch-stat-item">
                <span className="launch-stat-label">Data Sources</span>
                <span className="launch-stat-value">
                  {proposalData.filesMeta.length} File
                  {proposalData.filesMeta.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="launch-stat-item">
                <span className="launch-stat-label">Sections</span>
                <span className="launch-stat-value">
                  {proposalData.selectedSections.length} Selected
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="page-footer">
          <div className="page-footer-left">
            <button
              className="btn btn-ghost"
              onClick={() => handleEditStep(4, "/parameters")}
            >
              ← Back
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
