"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { FileText, Clock, Trash2, Loader2 } from "lucide-react";
import { logger } from "@/utils/logger";
import { toast } from "@/utils/toast";
import Button from "@/components/common/Button";

import styles from "./DraftsPage.module.scss";

import { useWizardActions } from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDrafts } from "@/hooks/useDrafts";
import { useClients } from "@/hooks/useClients";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import type { SavedDraft } from "@/interfaces/draftInterfaces";
import type { ProposalData } from "@/interfaces/proposalInterfaces";
import { formatDateWithTime } from "@/utils/dateUtils";
import PageLayout from "@/layouts/AppLayout";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import SkeletonGrid from "@/components/common/SkeletonGrid";
import TemplateSelectionModal from "@/components/modals/TemplateSelectionModal";
import NewClientModal from "@/components/modals/NewClientModal";
import DraftCardSkeleton from "@/components/common/skeletons/DraftCardSkeleton";

const DeleteDraftModal = dynamic(() => import("@/components/modals/DeleteDraftModal"), {
  ssr: false,
});

const DeleteAllDraftsModal = dynamic(() => import("@/components/modals/DeleteAllDraftsModal"), {
  ssr: false,
});

export default function DraftsPage(): JSX.Element {
  const { updateProposalData, setCurrentStep, setMaxStepReached, setGeneratedProposalId } = useWizardActions();
  const setDraftStage = useDraftSessionStore((s) => s.setDraftStage);
  const setCompletedSteps = useDraftSessionStore((s) => s.setCompletedSteps);
  const setCurrentDraftId = useDraftSessionStore((s) => s.setCurrentDraftId);
  const router = useRouter();

  const { drafts, isLoading, refetch } = useDrafts({ autoFetch: true });
  const { clients } = useClients({ autoFetch: true });
  const getDraftFromStore = useDraftStore(state => state.getDraft);
  const deleteDraftFromStore = useDraftStore(state => state.deleteDraft);
  const deleteAllDraftsFromStore = useDraftStore(state => state.deleteAllDrafts);

  const [loadingDraftId, setLoadingDraftId] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showNewClientModal, setShowNewClientModal] = useState<boolean>(false);
  const [newClientData, setNewClientData] = useState<{
    client: { id: number; name: string };
    notes: string;
    uploadedFiles: File[];
  } | undefined>(undefined);
  const [deleteModalData, setDeleteModalData] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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


  const handleNewProposalClick = useCallback((): void => {
    // Clear draft ID to ensure new proposal doesn't update existing draft
    setCurrentDraftId(null);
    setShowTemplateModal(true);
  }, [setCurrentDraftId]);

  const handleNewClientFromModal = useCallback((): void => {
    setShowTemplateModal(false);
    setShowNewClientModal(true);
  }, []);

  const handleClientCreated = useCallback((client: { id: number; name: string }, notes: string, uploadedFiles: File[]): void => {
    setNewClientData({ client, notes, uploadedFiles });
    setShowNewClientModal(false);
    setShowTemplateModal(true);
  }, []);

  const handleLoadDraft = useCallback(async (draftId: string): Promise<void> => {
    try {
      setLoadingDraftId(draftId);
      console.log('[DraftsPage] Loading draft:', draftId);
      const fullDraft: SavedDraft = await getDraftFromStore(draftId);
      console.log('[DraftsPage] Draft loaded successfully:', fullDraft);

      logger.info('[DraftsPage] Loading draft', {
        draftId,
        hasGeneratedContent: Object.keys(fullDraft.generatedContent || {}).length > 0,
        sectionCount: Object.keys(fullDraft.generatedContent || {}).length,
        stage: fullDraft.stage,
        lastLocation: fullDraft.lastLocation,
      });

      // Restore wizard state with generated content included in proposalData
      const proposalData = fullDraft.wizardState.proposalData as any;
      const restoredProposalData: Partial<ProposalData> = {
        ...(proposalData || {}),
        // Restore generated content into sections field
        sections: fullDraft.generatedContent || {},
        // Ensure selectedDocumentIds and filesMeta are preserved
        selectedDocumentIds: (proposalData?.selectedDocumentIds) || [],
        filesMeta: (proposalData?.filesMeta) || [],
        // Ensure selectedSections and sectionDisplayNames are preserved
        selectedSections: (proposalData?.selectedSections) || [],
        sectionDisplayNames: (proposalData?.sectionDisplayNames) || {},
      };

      updateProposalData(restoredProposalData);
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
        case "wizard_parameters":
          router.push("/parameters");
          break;
        case "wizard_review":
          router.push("/review");
          break;
        case "web_view":
          if (fullDraft.proposalId) {
            router.push(`/proposal/${fullDraft.proposalId}`);
          } else {
            router.push("/parameters");
          }
          break;
        case "ai_sections":
          router.push("/generating");
          break;
        default:
          router.push("/parameters");
      }
    } catch (error) {
      console.error('[DraftsPage] Failed to load draft:', error);
      logger.error("Failed to load draft:", error);
      toast.error("Failed to load draft");
    } finally {
      setLoadingDraftId(null);
    }
  }, [getDraftFromStore, updateProposalData, setCurrentStep, setDraftStage, setCompletedSteps, setMaxStepReached, setCurrentDraftId, setGeneratedProposalId, router]);

  const handleDeleteDraft = useCallback((id: string, name: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    setDeleteModalData({ id, name });
  }, []);

  const confirmDeleteDraft = useCallback(async (): Promise<void> => {
    if (!deleteModalData) return;

    try {
      await deleteDraftFromStore(deleteModalData.id);
      toast.success("Draft deleted");
      setDeleteModalData(null);
    } catch (error) {
      logger.error("Failed to delete draft:", error);
      toast.error("Failed to delete draft");
    }
  }, [deleteModalData, deleteDraftFromStore]);

  const confirmDeleteAllDrafts = useCallback(async (): Promise<void> => {
    try {
      await deleteAllDraftsFromStore();
      toast.success("All drafts deleted");
      setShowDeleteAllModal(false);
    } catch (error) {
      logger.error("Failed to delete all drafts:", error);
      toast.error("Failed to delete all drafts");
    }
  }, [deleteAllDraftsFromStore]);

  const getStatusLabel = useCallback((status: string): string => {
    if (status === "draft") return "Draft";
    if (status === "generating") return "Generating";
    if (status === "completed") return "Completed";
    return "In Progress";
  }, []);

  const getLocationLabel = useCallback((location: string): string => {
    switch (location) {
      case "wizard_parameters":
        return "Parameters";
      case "wizard_review":
        return "Review";
      case "web_view":
        return "Generated";
      case "ai_sections":
        return "AI Generation";
      default:
        return "Unknown";
    }
  }, []);

  return (
    <PageLayout>
      <PageHeader
        title="Drafts"
        subtitle="Resume work on proposals that are in progress or pending completion."
        action={
          !isLoading && drafts.length > 0 ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteAllModal(true)}
            >
              Delete All
            </Button>
          ) : undefined
        }
      />

        {!mounted ? (
          <SkeletonGrid
            className={styles.draftsGrid}
            renderItem={() => <DraftCardSkeleton />}
          />
        ) : isLoading ? (
          <SkeletonGrid
            className={styles.draftsGrid}
            renderItem={() => <DraftCardSkeleton />}
          />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={<FileText size={48} />}
            title="No drafts yet"
            subtitle="Drafts are automatically saved as you work on proposals. Start a new proposal to create your first draft."
            ctaLabel="Create New Proposal"
            onCtaClick={handleNewProposalClick}
          />
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
                  <Button
                    variant="ghost"
                    iconOnly
                    onClick={(e) => handleDeleteDraft(draft.id, draft.title || "Untitled Proposal", e)}
                    aria-label="Delete draft"
                    title="Delete this draft"
                    className={styles.deleteBtn}
                  >
                    <Trash2 size={14} />
                  </Button>
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
                      {formatDateWithTime(draft.updatedAt)}
                    </span>
                  </div>
                  <div className={styles.draftLocation}>
                    {getLocationLabel(draft.lastLocation)}
                  </div>
                </div>

                <div className={styles.draftFooter}>
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    loading={loadingDraftId === draft.id}
                  >
                    Resume Editing
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

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

      {showDeleteAllModal && (
        <DeleteAllDraftsModal
          draftCount={drafts.length}
          onClose={() => setShowDeleteAllModal(false)}
          onConfirm={confirmDeleteAllDrafts}
        />
      )}
    </PageLayout>
  );
}
