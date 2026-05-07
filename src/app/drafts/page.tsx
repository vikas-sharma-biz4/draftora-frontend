"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Clock, Trash2 } from "lucide-react";

import styles from "./page.module.scss";

import { DRAFTS_STORAGE_KEY } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import type { SavedDraft } from "@/hooks/useSaveDraft";
import type { ProposalData } from "@/types/proposal.types";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

export default function DraftsPage(): JSX.Element {
  const { updateProposalData, setCurrentStep, setDraftStage, setCompletedSteps, setMaxStepReached, hydrated } = useProposal();
  const router = useRouter();
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    loadDrafts();
  }, [hydrated]);

  function loadDrafts(): void {
    try {
      const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
      const allDrafts = raw ? (JSON.parse(raw) as SavedDraft[]) : [];
      console.log("Loaded drafts:", allDrafts.length, allDrafts);
      setDrafts(allDrafts);
    } catch (error) {
      console.error("Failed to load drafts:", error);
      setDrafts([]);
    }
  }

  function handleLoadDraft(draft: SavedDraft): void {
    updateProposalData(draft.proposalData as Partial<ProposalData>);
    setCurrentStep(draft.currentStep);

    // Handle old drafts that don't have the new fields
    setDraftStage(draft.draftStage || "wizard_in_progress");
    setCompletedSteps(draft.completedSteps || []);
    setMaxStepReached(draft.maxStepReached || draft.currentStep);

    // Navigate to the correct pipeline stage based on lastLocation
    // Default to "/" for old drafts without lastLocation
    const location = draft.lastLocation || (draft.currentStep >= 4 ? "WIZARD_PARAMETERS" : null);
    switch (location) {
      case "WIZARD_PARAMETERS":
        router.push("/parameters");
        break;
      case "WIZARD_REVIEW":
        router.push("/review");
        break;
      case "WEB_VIEW":
        // Navigate to web-view (proposalId is handled by the backend draft system)
        router.push("/web-view");
        break;
      default:
        router.push("/");
    }
  }

  function handleDeleteDraft(id: string, e: React.MouseEvent): void {
    e.stopPropagation();
    const updated = drafts.filter((d) => d.id !== id);
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updated));
      setDrafts(updated);
    } catch {
      // Ignore
    }
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function getStatusLabel(draft: SavedDraft): string {
    if (draft.currentStep === 1) return "Defining Scope";
    if (draft.currentStep === 2) return "Knowledge Base";
    if (draft.currentStep === 3) return "Template Selection";
    if (draft.currentStep === 4) return "Parameters";
    if (draft.currentStep === 5) return "Review";
    return "In Progress";
  }

  return (
    <div className="app-container">
      <MainSidebar />
      <main className="main-content">
        <h1 className="page-title">Drafts</h1>
        <p className="page-subtitle">
          Resume work on proposals that are in progress or pending completion.
        </p>

        {drafts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FileText size={48} />
            </div>
            <div className={styles.emptyTitle}>No drafts yet</div>
            <div className={styles.emptyDesc}>
              Drafts are automatically saved as you work on proposals. Start a new proposal to create your first draft.
            </div>
            <button className="btn btn-primary" onClick={() => router.push("/")}>
              Create New Proposal
            </button>
          </div>
        ) : (
          <div className={styles.draftsGrid}>
            {drafts.map((draft) => (
              <article
                key={draft.id}
                className={styles.draftCard}
                onClick={() => handleLoadDraft(draft)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLoadDraft(draft);
                }}
              >
                <div className={styles.draftHeader}>
                  <div className={styles.draftIcon}>
                    <FileText size={20} />
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeleteDraft(draft.id, e)}
                    aria-label="Delete draft"
                    title="Delete draft"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className={styles.draftBody}>
                  <div className={styles.draftTitle}>{draft.title || "Untitled Proposal"}</div>
                  {draft.clientName && (
                    <div className={styles.draftClient}>{draft.clientName}</div>
                  )}
                  <div className={styles.draftMeta}>
                    <span className={styles.draftStatus}>
                      <span className={styles.statusDot} />
                      {getStatusLabel(draft)}
                    </span>
                    <span className={styles.draftDate}>
                      <Clock size={12} />
                      {formatDate(draft.savedAt)}
                    </span>
                  </div>
                </div>

                <div className={styles.draftFooter}>
                  <button className="btn btn-ghost btn-sm btn-full">
                    Resume Editing →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
