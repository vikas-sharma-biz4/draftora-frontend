"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { FileText } from "lucide-react";
import { logger } from "@/utils/logger";
import { toast } from "@/utils/toast";
import Button from "@/components/common/Button";
import SearchBar from "@/components/common/SearchBar/SearchBar";
import { useDebounce } from "@/hooks/useDebounce";

import styles from "./DraftsPage.module.scss";

import { removeDraftTemplateMeta } from "@/utils/draftTemplateCache";
import { DRAFT_UI_STATE_STORAGE_KEY } from "@/constants/storageKeys";
import DraftCard from "@/components/common/DraftCard";
import { useWizardActions } from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDrafts } from "@/hooks/useDrafts";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useClients } from "@/hooks/useClients";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import type { SavedDraft } from "@/interfaces/draftInterfaces";
import type { ProposalWizardData } from "@/interfaces/proposalInterfaces";
import { formatDateWithTime } from "@/utils/dateUtils";
import PageLayout from "@/layouts/AppLayout";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import SkeletonGrid from "@/components/common/SkeletonGrid";
import TemplateSelectionModal from "@/components/modals/TemplateSelectionModal/TemplateSelectionModal";
import NewClientModal from "@/components/modals/NewClientModal";
import DraftCardSkeleton from "@/components/common/Skeletons/DraftCardSkeleton";

const DeleteDraftModal = dynamic(() => import("@/components/modals/DeleteDraftModal"), {
  ssr: false,
});

const DeleteAllDraftsModal = dynamic(() => import("@/components/modals/DeleteAllDraftsModal"), {
  ssr: false,
});

export default function DraftsPage(): JSX.Element {
  const {
    updateProposalData,
    setCurrentStep,
    setMaxStepReached,
    setGeneratedProposalId,
    setCurrentProposalId,
  } = useWizardActions();
  const setDraftStage = useDraftSessionStore((s) => s.setDraftStage);
  const setCompletedSteps = useDraftSessionStore((s) => s.setCompletedSteps);
  const setCurrentDraftId = useDraftSessionStore((s) => s.setCurrentDraftId);
  const setFromHistory = useDraftSessionStore((s) => s.setFromHistory);
  const router = useRouter();

  const { drafts, isLoading, error, refetch } = useDrafts();
  const { clients } = useClients({ autoFetch: false });
  const getDraftFromStore = useDraftStore((state) => state.getDraft);
  const deleteDraftFromStore = useDraftStore((state) => state.deleteDraft);
  const deleteAllDraftsFromStore = useDraftStore((state) => state.deleteAllDrafts);

  useErrorToast(error, "Failed to load drafts");

  const [loadingDraftId, setLoadingDraftId] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showNewClientModal, setShowNewClientModal] = useState<boolean>(false);
  const [newClientData, setNewClientData] = useState<
    | {
        client: { id: number; name: string };
        notes: string;
        uploadedFiles: File[];
      }
    | undefined
  >(undefined);
  const [deleteModalData, setDeleteModalData] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const filteredDrafts = useMemo(() => {
    if (!debouncedSearch) return drafts;
    const q = debouncedSearch.toLowerCase();
    return drafts.filter(
      (d) =>
        (d.title?.toLowerCase().includes(q) ?? false) ||
        (d.clientName?.toLowerCase().includes(q) ?? false)
    );
  }, [drafts, debouncedSearch]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNewProposalClick = useCallback((): void => {
    setCurrentDraftId(null);
    setFromHistory(false);
    setShowTemplateModal(true);
  }, [setCurrentDraftId, setFromHistory]);

  const handleNewClientFromModal = useCallback((): void => {
    setShowTemplateModal(false);
    setShowNewClientModal(true);
  }, []);

  const handleClientCreated = useCallback(
    (client: { id: number; name: string }, notes: string, uploadedFiles: File[]): void => {
      setNewClientData({ client, notes, uploadedFiles });
      setShowNewClientModal(false);
      setShowTemplateModal(true);
    },
    []
  );

  const handleLoadDraft = useCallback(
    async (draftId: string): Promise<void> => {
      try {
        setFromHistory(false);
        setLoadingDraftId(draftId);
        const fullDraft: SavedDraft = await getDraftFromStore(draftId);

        // Restore wizard state with generated content included in proposalData
        const proposalData: ProposalWizardData = fullDraft.wizardState.proposalData;

        logger.info("[DraftsPage] Loading draft", {
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
        const restoredProposalData: Partial<ProposalWizardData> = {
          ...(proposalData || {}),
          // Restore generated content into sections field
          sections: fullDraft.generatedContent || {},
          // Ensure selectedDocumentIds and filesMeta are preserved
          selectedDocumentIds: proposalData?.selectedDocumentIds || [],
          filesMeta: proposalData?.filesMeta || [],
          // Ensure selectedSections and sectionDisplayNames are preserved
          selectedSections: proposalData?.selectedSections || [],
          sectionDisplayNames: proposalData?.sectionDisplayNames || {},
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
          setCurrentProposalId(fullDraft.proposalId);
        }

        // Store UI state for restoration after navigation
        const uiState = fullDraft.uiState || {
          scrollPosition: 0,
          activeSection: null,
          expandedSections: [],
          lastVisibleSection: null,
        };
        sessionStorage.setItem(DRAFT_UI_STATE_STORAGE_KEY, JSON.stringify(uiState));

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
        logger.error("[DraftsPage] Failed to load draft:", error);
        toast.error("Failed to load draft");
      } finally {
        setLoadingDraftId(null);
      }
    },
    [
      getDraftFromStore,
      updateProposalData,
      setCurrentStep,
      setDraftStage,
      setCompletedSteps,
      setMaxStepReached,
      setCurrentDraftId,
      setGeneratedProposalId,
      setFromHistory,
      router,
    ]
  );

  const handleDeleteDraft = useCallback((id: string, name: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    setDeleteModalData({ id, name });
  }, []);

  const confirmDeleteDraft = useCallback(async (): Promise<void> => {
    if (!deleteModalData) return;

    try {
      await deleteDraftFromStore(deleteModalData.id);
      removeDraftTemplateMeta(deleteModalData.id);
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

  return (
    <PageLayout>
      <PageHeader
        title="Drafts"
        subtitle="Resume work on proposals that are in progress or pending completion."
        action={
          !isLoading && drafts.length > 0 ? (
            <button className={styles.deleteAllBtn} onClick={() => setShowDeleteAllModal(true)}>
              Delete All
            </button>
          ) : undefined
        }
      />

      {!mounted || isLoading ? (
        <SkeletonGrid className={styles.draftsGrid} renderItem={() => <DraftCardSkeleton />} />
      ) : drafts.length === 0 ? (
        <EmptyState
          icon={<FileText size={48} />}
          title="Nothing to resume yet"
          subtitle="Proposals in progress are automatically saved here. Start a new proposal to create your first draft."
          ctaLabel="Create New Proposal"
          onCtaClick={handleNewProposalClick}
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by title or client..."
              className={styles.searchBar}
            />
          </div>

          {filteredDrafts.length === 0 ? (
            <EmptyState
              icon={<FileText size={48} />}
              title="No matching drafts"
              subtitle="Try adjusting your search."
            />
          ) : (
            <div className={styles.draftsGrid}>
              {filteredDrafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  loadingDraftId={loadingDraftId}
                  onLoad={(id) => void handleLoadDraft(id)}
                  onDelete={handleDeleteDraft}
                />
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
