"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { FileText, Clock, Trash2, Loader2, Search, X, ArrowRight } from "lucide-react";
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
import TemplateSelectionModal from "@/components/modals/TemplateSelectionModal/TemplateSelectionModal";
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

  const { drafts, isLoading, refetch } = useDrafts();
  const { clients } = useClients({ autoFetch: false });
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

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<"all" | "parameters" | "review" | "generated">("all");

  // Filter drafts
  const filteredDrafts = useMemo(() => {
    let filtered = [...drafts];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (draft) =>
          (draft.title || "Untitled Proposal").toLowerCase().includes(query) ||
          (draft.clientName || "").toLowerCase().includes(query)
      );
    }

    // Apply location filter
    if (locationFilter !== "all") {
      const locationMap: Record<string, string> = {
        parameters: "wizard_parameters",
        review: "wizard_review",
        generated: "web_view",
      };
      filtered = filtered.filter((draft) => draft.lastLocation === locationMap[locationFilter]);
    }

    return filtered;
  }, [drafts, searchQuery, locationFilter]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Refresh drafts when page becomes visible only if cache is stale
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const isCacheValid = useDraftStore.getState().isCacheValid();
        if (!isCacheValid) {
          refetch();
        }
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

      // Restore wizard state with generated content included in proposalData
      const proposalData = fullDraft.wizardState.proposalData as any;

      logger.info('[DraftsPage] Loading draft', {
        draftId,
        hasGeneratedContent: Object.keys(fullDraft.generatedContent || {}).length > 0,
        sectionCount: Object.keys(fullDraft.generatedContent || {}).length,
        stage: fullDraft.stage,
        lastLocation: fullDraft.lastLocation,
        // Log the critical fields from the saved draft
        savedTitle: fullDraft.title,
        savedClientName: fullDraft.clientName,
        savedSelectedSections: proposalData?.selectedSections,
        savedFilesMeta: proposalData?.filesMeta,
        savedSelectedDocumentIds: proposalData?.selectedDocumentIds,
        savedWebReferences: proposalData?.webReferences,
        savedSectionDisplayNames: proposalData?.sectionDisplayNames,
      });
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
          <>
            {/* Search and Filter Controls */}
            <div className={styles.controlsContainer}>
              {/* Filter Pills and Delete All Button Group */}
              <div className={styles.filterSortGroup}>
                {/* Filter Pills */}
                <div className={styles.filterGroup}>
                  <button
                    onClick={() => setLocationFilter("all")}
                    className={`${styles.filterPill} ${locationFilter === "all" ? styles.active : ""}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setLocationFilter("parameters")}
                    className={`${styles.filterPill} ${locationFilter === "parameters" ? styles.active : ""}`}
                  >
                    Parameters
                  </button>
                  <button
                    onClick={() => setLocationFilter("review")}
                    className={`${styles.filterPill} ${locationFilter === "review" ? styles.active : ""}`}
                  >
                    Review
                  </button>
                  <button
                    onClick={() => setLocationFilter("generated")}
                    className={`${styles.filterPill} ${locationFilter === "generated" ? styles.active : ""}`}
                  >
                    Generated
                  </button>
                </div>

                {/* Delete All Button */}
                {!isLoading && drafts.length > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteAllModal(true)}
                    className={styles.deleteAllButton}
                  >
                    Delete All
                  </Button>
                )}
              </div>

              {/* Search Input */}
              <div className={styles.searchWrapper}>
                <Search size={18} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search drafts by title or client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className={styles.clearButton}
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            {filteredDrafts.length === 0 ? (
              <EmptyState
                icon={<Search size={48} />}
                title="No Results Found"
                subtitle="Try adjusting your search or filters."
              />
            ) : (
              <div className={styles.draftsGrid}>
                {filteredDrafts.map((draft) => (
              <article
                key={draft.id}
                className={styles.draftCard}
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
                    variant="primary"
                    size="sm"
                    fullWidth
                    loading={loadingDraftId === draft.id}
                    className={styles.primaryCtaButton}
                    onClick={() => void handleLoadDraft(draft.id)}
                  >
                    <span className={styles.buttonContent}>
                      Resume Editing
                      <ArrowRight size={14} className={styles.buttonArrow} />
                    </span>
                  </Button>
                </div>
              </article>
            ))}
          </div>
            )}
          </>
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
