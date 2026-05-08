"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Clock, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import styles from "./page.module.scss";

import { useProposal } from "@/context/ProposalContext";
import { useDrafts } from "@/hooks/useDrafts";
import { useClients } from "@/hooks/useClients";
import { useDraftStore } from "@/store/draftStore";
import type { SavedDraft } from "@/types/draft.types";
import type { ProposalData } from "@/types/proposal.types";
import TemplateSelectionModal from "@/components/modals/TemplateSelectionModal";
import NewClientModal from "@/components/modals/NewClientModal";
import DraftCardSkeleton from "@/components/skeletons/DraftCardSkeleton";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

const DeleteDraftModal = dynamic(() => import("@/components/modals/DeleteDraftModal"), {
  ssr: false,
});

export default function DraftsPage(): JSX.Element {
  const { updateProposalData, setCurrentStep, setDraftStage, setCompletedSteps, setMaxStepReached, setGeneratedProposalId, setCurrentDraftId } = useProposal();
  const router = useRouter();
  
  const { drafts, isLoading, refetch } = useDrafts({ force: true });
  const { clients } = useClients({ autoFetch: false });
  const getDraftFromStore = useDraftStore(state => state.getDraft);
  const deleteDraftFromStore = useDraftStore(state => state.deleteDraft);
  
  const [loadingDraftId, setLoadingDraftId] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showNewClientModal, setShowNewClientModal] = useState<boolean>(false);
  const [newClientData, setNewClientData] = useState<{
    client: { id: number; name: string };
    notes: string;
    uploadedFiles: File[];
  } | undefined>(undefined);
  const [deleteModalData, setDeleteModalData] = useState<{ id: string; name: string } | null>(null);

  // Force refresh drafts when page becomes visible to show updated status
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch]);


  function handleNewProposalClick(): void {
    // Clear draft ID to ensure new proposal doesn't update existing draft
    setCurrentDraftId(null);
    setShowTemplateModal(true);
  }

  function handleNewClientFromModal(): void {
    setShowTemplateModal(false);
    setShowNewClientModal(true);
  }

  function handleClientCreated(client: { id: number; name: string }, notes: string, uploadedFiles: File[]): void {
    setNewClientData({ client, notes, uploadedFiles });
    setShowNewClientModal(false);
    setShowTemplateModal(true);
  }

  async function handleLoadDraft(draftId: string): Promise<void> {
    try {
      setLoadingDraftId(draftId);
      const fullDraft: SavedDraft = await getDraftFromStore(draftId);

      // Restore wizard state
      updateProposalData(fullDraft.wizardState.proposalData as Partial<ProposalData>);
      setCurrentStep(fullDraft.wizardState.currentStep);
      setDraftStage(fullDraft.stage);
      setCompletedSteps(fullDraft.wizardState.completedSteps);
      setMaxStepReached(fullDraft.wizardState.maxStepReached);

      // Set current draft ID to ensure updates go to the same draft
      setCurrentDraftId(fullDraft.id);

      // Restore proposal ID if exists
      if (fullDraft.proposalId) {
        setGeneratedProposalId(fullDraft.proposalId);
      }

      // Store UI state for restoration after navigation
      const uiState = fullDraft.uiState || {
        scrollPosition: 0,
        activeSection: null,
        expandedSections: [],
        lastVisibleSection: null,
      };
      sessionStorage.setItem("draft_ui_state", JSON.stringify(uiState));

      // Navigate to the correct pipeline stage based on lastLocation
      switch (fullDraft.lastLocation) {
        case "WIZARD_PARAMETERS":
          router.push("/parameters");
          break;
        case "WIZARD_REVIEW":
          router.push("/review");
          break;
        case "WEB_VIEW":
          if (fullDraft.proposalId) {
            router.push(`/proposal/${fullDraft.proposalId}`);
          } else {
            router.push("/parameters");
          }
          break;
        case "AI_SECTIONS":
          router.push("/generating");
          break;
        default:
          router.push("/parameters");
      }
    } catch (error) {
      console.error("Failed to load draft:", error);
      toast.error("Failed to load draft");
    } finally {
      setLoadingDraftId(null);
    }
  }

  function handleDeleteDraft(id: string, name: string, e: React.MouseEvent): void {
    e.stopPropagation();
    setDeleteModalData({ id, name });
  }

  async function confirmDeleteDraft(): Promise<void> {
    if (!deleteModalData) return;

    try {
      await deleteDraftFromStore(deleteModalData.id);
      toast.success("Draft deleted");
      setDeleteModalData(null);
    } catch (error) {
      console.error("Failed to delete draft:", error);
      toast.error("Failed to delete draft");
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

  function getStatusLabel(status: string): string {
    if (status === "draft") return "Draft";
    if (status === "generating") return "Generating";
    if (status === "completed") return "Completed";
    return "In Progress";
  }

  function getLocationLabel(location: string): string {
    switch (location) {
      case "WIZARD_PARAMETERS":
        return "Parameters";
      case "WIZARD_REVIEW":
        return "Review";
      case "WEB_VIEW":
        return "Generated";
      case "AI_SECTIONS":
        return "AI Generation";
      default:
        return "Unknown";
    }
  }

  return (
    <div className="app-container">
      <MainSidebar />
      <main className="main-content">
        <h1 className="page-title">Drafts</h1>
        <p className="page-subtitle">
          Resume work on proposals that are in progress or pending completion.
        </p>

        {isLoading ? (
          <div className={styles.draftsGrid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <DraftCardSkeleton key={i} />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FileText size={48} />
            </div>
            <div className={styles.emptyTitle}>No drafts yet</div>
            <div className={styles.emptyDesc}>
              Drafts are automatically saved as you work on proposals. Start a new proposal to create your first draft.
            </div>
            <button className="btn btn-primary" onClick={handleNewProposalClick}>
              Create New Proposal
            </button>
          </div>
        ) : (
          <div className={styles.draftsGrid}>
            {drafts.map((draft) => (
              <article
                key={draft.id}
                className={styles.draftCard}
                onClick={() => void handleLoadDraft(draft.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleLoadDraft(draft.id);
                }}
              >
                <div className={styles.draftHeader}>
                  <div className={styles.draftIcon}>
                    <FileText size={20} />
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeleteDraft(draft.id, draft.title || "Untitled Proposal", e)}
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
                      {getStatusLabel(draft.status)}
                    </span>
                    <span className={styles.draftDate}>
                      <Clock size={12} />
                      {formatDate(draft.updatedAt)}
                    </span>
                  </div>
                  <div className={styles.draftLocation}>
                    {getLocationLabel(draft.lastLocation)}
                  </div>
                </div>

                <div className={styles.draftFooter}>
                  {loadingDraftId === draft.id ? (
                    <button className="btn btn-ghost btn-sm btn-full" disabled>
                      <Loader2 size={16} className={styles.spinning} />
                      Loading...
                    </button>
                  ) : (
                    <button className="btn btn-ghost btn-sm btn-full">
                      Resume Editing →
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {showTemplateModal && (
        <TemplateSelectionModal
          onClose={() => setShowTemplateModal(false)}
          onNewClient={handleNewClientFromModal}
          initialClients={clients}
          enableTemplateSelection={true}
        />
      )}

      {showNewClientModal && (
        <NewClientModal
          onClose={() => setShowNewClientModal(false)}
          onClientCreated={handleClientCreated}
        />
      )}

      {deleteModalData && (
        <DeleteDraftModal
          draftName={deleteModalData.name}
          onClose={() => setDeleteModalData(null)}
          onConfirm={confirmDeleteDraft}
        />
      )}
    </div>
  );
}
