"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { FileText } from "lucide-react";
import { logger } from "@/utils/logger";
import { toast } from "@/utils/toast";
import { MESSAGES } from "@/constants/messages";
import Button from "@/components/common/Button";
import SearchBar from "@/components/common/SearchBar/SearchBar";
import { useDebounce } from "@/hooks/useDebounce";

import styles from "./DraftsPage.module.scss";

import { removeDraftTemplateMeta } from "@/utils/draftTemplateCache";
import { DRAFT_UI_STATE_STORAGE_KEY } from "@/constants/storageKeys";
import DraftCard from "@/components/common/DraftCard";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";
import { useProposalDownload } from "@/hooks/useProposalDownload";
import {
  useProposalWizardStore,
  useWizardActions,
} from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDrafts } from "@/hooks/useDrafts";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useClients } from "@/hooks/useClients";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import type { DraftMetadata, SavedDraft } from "@/interfaces/draftInterfaces";
import type { ProposalWizardData } from "@/interfaces/proposalInterfaces";
import { deleteVersionDraft as deleteVersionDraftApi } from "@/services/proposal";
import { sortByUpdatedAtDesc } from "@/utils/sortUtils";
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

// Version draft IDs are prefixed so unified handlers can distinguish them from
// wizard draft IDs without needing a separate type in the combined list.
const VERSION_PREFIX = "version:";

export default function DraftsPage(): JSX.Element {
  const {
    updateProposalData,
    setCurrentStep,
    setMaxStepReached,
    setGeneratedProposalId,
    setCurrentProposalId,
    setLoadedFromDraft,
  } = useWizardActions();
  const setDraftStage = useDraftSessionStore((s) => s.setDraftStage);
  const setCompletedSteps = useDraftSessionStore((s) => s.setCompletedSteps);
  const setCurrentDraftId = useDraftSessionStore((s) => s.setCurrentDraftId);
  const setFromHistory = useDraftSessionStore((s) => s.setFromHistory);
  const router = useRouter();

  const { drafts, isLoading, error } = useDrafts({ force: true });
  const { clients } = useClients({ autoFetch: false });
  const { downloadProposal, downloadProposalPdf } = useProposalDownload();
  const getDraftFromStore = useDraftStore((state) => state.getDraft);
  const deleteDraftFromStore = useDraftStore((state) => state.deleteDraft);
  const deleteAllDraftsFromStore = useDraftStore((state) => state.deleteAllDrafts);

  useErrorToast(error, "Failed to load drafts");

  const [loadingDraftId, setLoadingDraftId] = useState<string | null>(null);
  const [downloadingDocxIds, setDownloadingDocxIds] = useState<Set<number>>(new Set());
  const [downloadingPdfIds, setDownloadingPdfIds] = useState<Set<number>>(new Set());
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

  // --- Version drafts (pending proposals branched from History rows) ---
  const versionDrafts = useProposalStore((s) => s.versionDrafts);
  const fetchVersionDrafts = useProposalStore((s) => s.fetchVersionDrafts);
  const removeVersionDraft = useProposalStore((s) => s.removeVersionDraft);

  // Populate version drafts on mount
  useEffect(() => {
    void fetchVersionDrafts();
  }, [fetchVersionDrafts]);

  // Combined + filtered list: version drafts mapped to DraftMetadata shape and merged
  // with wizard drafts, then sorted newest-updated-first and filtered by search query.
  const combinedDrafts = useMemo((): DraftMetadata[] => {
    const versionAsDrafts: DraftMetadata[] = versionDrafts.map((vd) => ({
      id: `${VERSION_PREFIX}${vd.id}`,
      proposalId: vd.id,
      title: vd.title,
      clientName: vd.clientName ?? "",
      status: "completed" as const,
      lastLocation: "web_view" as const,
      stage: "generated" as const,
      updatedAt: vd.updatedAt ?? vd.createdAt,
    }));

    const merged = sortByUpdatedAtDesc([...drafts, ...versionAsDrafts]);

    if (!debouncedSearch) return merged;
    const q = debouncedSearch.toLowerCase();
    return merged.filter(
      (d) =>
        (d.title?.toLowerCase().includes(q) ?? false) ||
        (d.clientName?.toLowerCase().includes(q) ?? false)
    );
  }, [drafts, versionDrafts, debouncedSearch]);

  const totalDraftCount = drafts.length + versionDrafts.length;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNewProposalClick = useCallback((): void => {
    setCurrentDraftId(null);
    setFromHistory(false);
    setShowTemplateModal(true);
  }, [setCurrentDraftId, setFromHistory]);

  const handleDraftDownloadDocx = useCallback(
    async (proposalId: number): Promise<void> => {
      setDownloadingDocxIds((prev) => new Set(prev).add(proposalId));
      try {
        await downloadProposal(proposalId);
      } finally {
        setDownloadingDocxIds((prev) => {
          const next = new Set(prev);
          next.delete(proposalId);
          return next;
        });
      }
    },
    [downloadProposal]
  );

  const handleDraftDownloadPdf = useCallback(
    async (proposalId: number): Promise<void> => {
      setDownloadingPdfIds((prev) => new Set(prev).add(proposalId));
      try {
        await downloadProposalPdf(proposalId);
      } finally {
        setDownloadingPdfIds((prev) => {
          const next = new Set(prev);
          next.delete(proposalId);
          return next;
        });
      }
    },
    [downloadProposalPdf]
  );

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
      // Version drafts are proposals — navigate directly to the proposal editor.
      if (draftId.startsWith(VERSION_PREFIX)) {
        const proposalId = draftId.slice(VERSION_PREFIX.length);
        router.push(`/proposal/${proposalId}`);
        return;
      }

      try {
        setFromHistory(false);
        setLoadingDraftId(draftId);
        const fullDraft: SavedDraft = await getDraftFromStore(draftId);

        const proposalData: ProposalWizardData = fullDraft.wizardState.proposalData;

        logger.info("[DraftsPage] Loading draft", {
          draftId,
          hasGeneratedContent: Object.keys(fullDraft.generatedContent || {}).length > 0,
          sectionCount: Object.keys(fullDraft.generatedContent || {}).length,
          stage: fullDraft.stage,
          lastLocation: fullDraft.lastLocation,
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
          sections: fullDraft.generatedContent || {},
          selectedDocumentIds: proposalData?.selectedDocumentIds || [],
          filesMeta: proposalData?.filesMeta || [],
          selectedSections: proposalData?.selectedSections || [],
          sectionDisplayNames: proposalData?.sectionDisplayNames || {},
        };

        updateProposalData(restoredProposalData);
        setCurrentStep(fullDraft.wizardState.currentStep);
        setDraftStage(fullDraft.stage);
        setCompletedSteps(fullDraft.wizardState.completedSteps);
        setMaxStepReached(fullDraft.wizardState.maxStepReached);
        setCurrentDraftId(fullDraft.id);

        if (fullDraft.proposalId) {
          setGeneratedProposalId(fullDraft.proposalId);
          setCurrentProposalId(fullDraft.proposalId);
        }

        // Restore prefetched recommendations from draft and signal parameters page
        // to skip auto-fetch and use these stored results instead.
        if (fullDraft.wizardState.prefetchedRecommendations) {
          useProposalWizardStore
            .getState()
            .setPrefetchedRecommendations(fullDraft.wizardState.prefetchedRecommendations);
        }
        setLoadedFromDraft(true);

        const uiState = fullDraft.uiState || {
          scrollPosition: 0,
          activeSection: null,
          expandedSections: [],
          lastVisibleSection: null,
        };
        sessionStorage.setItem(DRAFT_UI_STATE_STORAGE_KEY, JSON.stringify(uiState));

        // Clear loading state BEFORE navigation so React doesn't attempt a
        // state update on a partially-unmounted tree (prevents removeChild error).
        setLoadingDraftId(null);

        // Stage-aware navigation: if the proposal was already generated,
        // always go to the proposal page regardless of lastLocation.
        if (fullDraft.stage === "generated" && fullDraft.proposalId) {
          router.push(`/proposal/${fullDraft.proposalId}`);
        } else {
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
        }
      } catch (loadError) {
        logger.error("[DraftsPage] Failed to load draft:", loadError);
        toast.error(MESSAGES.DRAFT_LOAD_FAILED);
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
      setLoadedFromDraft,
      router,
    ]
  );

  const handleDeleteDraft = useCallback((id: string, name: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    setDeleteModalData({ id, name });
  }, []);

  const confirmDeleteDraft = useCallback(async (): Promise<void> => {
    if (!deleteModalData) return;
    const { id, name: _name } = deleteModalData;

    try {
      if (id.startsWith(VERSION_PREFIX)) {
        const proposalId = Number(id.slice(VERSION_PREFIX.length));
        await deleteVersionDraftApi(proposalId);
        removeVersionDraft(proposalId);
      } else {
        await deleteDraftFromStore(id);
        removeDraftTemplateMeta(id);
      }
      toast.success(MESSAGES.DRAFT_DELETED);
      setDeleteModalData(null);
    } catch (deleteError) {
      logger.error("Failed to delete draft:", deleteError);
      toast.error(MESSAGES.DRAFT_DELETE_FAILED);
    }
  }, [deleteModalData, deleteDraftFromStore, removeVersionDraft]);

  const confirmDeleteAllDrafts = useCallback(async (): Promise<void> => {
    try {
      await deleteAllDraftsFromStore();
      toast.success(MESSAGES.DRAFT_ALL_DELETED);
      setShowDeleteAllModal(false);
    } catch (deleteError) {
      logger.error("Failed to delete all drafts:", deleteError);
      toast.error(MESSAGES.DRAFT_ALL_DELETE_FAILED);
    }
  }, [deleteAllDraftsFromStore]);

  return (
    <PageLayout>
      <PageHeader
        title="Drafts"
        subtitle="Resume work on proposals that are in progress or pending completion."
      />

      {!mounted || isLoading ? (
        <SkeletonGrid className={styles.draftsGrid} renderItem={() => <DraftCardSkeleton />} />
      ) : totalDraftCount === 0 ? (
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
            <Button
              variant="danger-outline"
              size="sm"
              onClick={() => setShowDeleteAllModal(true)}
              style={{ marginLeft: "auto" }}
            >
              Delete All
            </Button>
          </div>

          {combinedDrafts.length === 0 ? (
            <EmptyState
              icon={<FileText size={48} />}
              title="No matching drafts"
              subtitle="Try adjusting your search."
            />
          ) : (
            <div className={styles.draftsGrid}>
              {combinedDrafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  loadingDraftId={loadingDraftId}
                  onLoad={(id) => void handleLoadDraft(id)}
                  onDelete={handleDeleteDraft}
                  isDownloadingDocx={
                    draft.proposalId !== null && downloadingDocxIds.has(draft.proposalId)
                  }
                  isDownloadingPdf={
                    draft.proposalId !== null && downloadingPdfIds.has(draft.proposalId)
                  }
                  onDownloadDocx={
                    draft.proposalId !== null
                      ? () => void handleDraftDownloadDocx(draft.proposalId as number)
                      : undefined
                  }
                  onDownloadPdf={
                    draft.proposalId !== null
                      ? () => void handleDraftDownloadPdf(draft.proposalId as number)
                      : undefined
                  }
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
