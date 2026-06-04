"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";

import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import Button from "@/components/common/Button";

import styles from "./ReviewPage.module.scss";

import { generateProposal, getProposal } from "@/services/proposal.service";
import { SECTION_DISPLAY_NAMES, PROPOSAL_TEMPLATES } from "@/constants";
import { DRAFT_UI_STATE_STORAGE_KEY } from "@/constants/storageKeys";
import {
  useProposalTitle,
  useClientName,
  useClientId,
  useProposalDescription,
  useSelectedSections,
  useSectionDisplayNames,
  useTone,
  useLengthPreference,
  useLanguage,
  useAiModel,
  useTemplateId,
  useTemplateType,
  useCurrentStep,
  useIsGenerating,
  useGeneratedProposalId,
  useCurrentProposalId,
  useEditMode,
  useMaxStepReached,
  useWizardActions,
  useFilesMeta,
  useWebReferences,
  useSelectedDocumentIds,
  useApprovalStatus,
} from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { usePipelineSteps } from "@/hooks/usePipelineSteps";
import { usePipelineStore } from "@/store/features/pipeline/pipelineSlice";
import type {
  ToneOption,
  LengthOption,
  ProposalWizardData,
  ProposalData,
} from "@/interfaces/proposalInterfaces";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { useWizardAutoSave } from "@/hooks/useWizardAutoSave";
import { useClients } from "@/hooks/useClients";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { formatBytes } from "@/utils/formatBytes";
import { formatDate } from "@/utils/dateUtils";

const PageLayout = dynamic(() => import("@/layouts/AppLayout"), { ssr: false });

const DynamicPipeline = dynamic(() => import("@/components/common/DynamicPipeline"), {
  ssr: false,
});

const ScopeEditorModal = dynamic(() => import("@/components/modals/ScopeEditorModal"), {
  ssr: false,
});

const KnowledgeBaseSelectorModal = dynamic(
  () => import("@/components/modals/KnowledgeBaseSelectorModal"),
  {
    ssr: false,
  }
);

const StyleVoiceEditorModal = dynamic(() => import("@/components/modals/StyleVoiceEditorModal"), {
  ssr: false,
});

const SectionsSelectorModal = dynamic(() => import("@/components/modals/SectionsSelectorModal"), {
  ssr: false,
});

const TemplateSelectorModal = dynamic(() => import("@/components/modals/TemplateSelectorModal"), {
  ssr: false,
});

export default function ReviewPage(): JSX.Element {
  // Use granular selectors for minimal re-renders
  const title = useProposalTitle();
  const clientName = useClientName();
  const clientId = useClientId();
  const description = useProposalDescription();
  const selectedSections = useSelectedSections();
  const sectionDisplayNames = useSectionDisplayNames();
  const tone = useTone();
  const lengthPreference = useLengthPreference();
  const language = useLanguage();
  const aiModel = useAiModel();
  const templateId = useTemplateId();
  const templateType = useTemplateType();
  const filesMeta = useFilesMeta();
  const webReferences = useWebReferences();
  const selectedDocumentIds = useSelectedDocumentIds();
  const currentStep = useCurrentStep();
  const isGenerating = useIsGenerating();
  const generatedProposalId = useGeneratedProposalId();
  const currentProposalId = useCurrentProposalId();
  const editMode = useEditMode();
  const maxStepReached = useMaxStepReached();
  const {
    updateProposalData,
    setCurrentStep,
    setIsGenerating,
    setGeneratedProposalId,
    setCurrentProposalId,
    setEditMode,
    setMaxStepReached,
  } = useWizardActions();

  // Reconstruct proposalData object for backward compatibility with existing code
  // This is a temporary measure - the component should eventually use granular selectors directly
  const proposalData = useMemo(
    () =>
      ({
        title,
        clientName,
        clientId,
        description,
        selectedSections,
        sectionDisplayNames,
        tone,
        lengthPreference,
        language,
        aiModel,
        templateId,
        templateType,
        files: [],
        filesMeta,
        selectedDocumentIds,
        customSections: [],
        contextualInstructions: "",
        webReferences,
      }) as ProposalWizardData,
    [
      title,
      clientName,
      clientId,
      description,
      selectedSections,
      sectionDisplayNames,
      tone,
      lengthPreference,
      language,
      aiModel,
      templateId,
      templateType,
      filesMeta,
      selectedDocumentIds,
      webReferences,
    ]
  );

  const { visitedPipelineSteps, syncVisitedStepsFromBackend, markStepVisitedOnBackend } =
    usePipelineSteps();
  const draftStage = useDraftSessionStore((s) => s.draftStage);
  const completedSteps = useDraftSessionStore((s) => s.completedSteps);
  const setDraftStage = useDraftSessionStore((s) => s.setDraftStage);
  const markStepCompleted = useDraftSessionStore((s) => s.markStepCompleted);
  const setCompletedSteps = useDraftSessionStore((s) => s.setCompletedSteps);
  const router = useRouter();
  const searchParams = useSearchParams();
  const handleSaveDraft = useSaveDraft();
  const isRegenerating = currentProposalId !== null;
  const approvalStatus = useApprovalStatus();
  const {
    clients,
    isLoading: isLoadingClients,
    refetch: refetchClients,
  } = useClients({ autoFetch: true });

  // Enable auto-save when user is in pipeline stage (but NOT during generation)
  useWizardAutoSave({ enabled: !isGenerating, debounceMs: 2000, approvalStatus });

  // Restore currentProposalId from URL params if not set in store
  useEffect(() => {
    const urlProposalId = searchParams.get("proposalId");
    if (urlProposalId && !currentProposalId) {
      setCurrentProposalId(Number(urlProposalId));
    }
  }, [searchParams, currentProposalId, setCurrentProposalId]);

  // Fetch proposal data when viewing from History to get approvalStatus
  useEffect(() => {
    const urlProposalId = searchParams.get("proposalId");
    if (urlProposalId || currentProposalId) {
      const proposalIdToFetch = Number(urlProposalId) || currentProposalId;
      if (proposalIdToFetch) {
        getProposal(proposalIdToFetch)
          .then((data: ProposalData) => {
            if (data?.approvalStatus) {
              updateProposalData({ approvalStatus: data.approvalStatus });
            }
          })
          .catch((error: unknown) => {
            logger.warn("[ReviewPage] Failed to fetch proposal for approvalStatus", error);
          });
      }
    }
  }, [searchParams, currentProposalId, updateProposalData]);

  // Sync visited steps from backend on mount
  useEffect(() => {
    if (currentProposalId) {
      syncVisitedStepsFromBackend(currentProposalId);
    }
  }, [currentProposalId, syncVisitedStepsFromBackend]);

  // For already-generated proposals (coming from History with proposalId in URL), immediately mark all steps as visited
  // This ensures the pipeline shows correct state even before backend sync completes
  useEffect(() => {
    const urlProposalId = searchParams.get("proposalId");
    if (urlProposalId || currentProposalId) {
      // This is viewing an existing proposal - mark all steps as visited
      const { markStepAsVisited } = usePipelineStore.getState();
      let needsUpdate = false;

      if (!visitedPipelineSteps.includes(1)) {
        markStepAsVisited(1);
        needsUpdate = true;
      }
      if (!visitedPipelineSteps.includes(2)) {
        markStepAsVisited(2);
        needsUpdate = true;
      }
      if (!visitedPipelineSteps.includes(3)) {
        markStepAsVisited(3);
        needsUpdate = true;
      }

      // Set draft stage to generated to enable full pipeline navigation
      setDraftStage("generated");
      setCompletedSteps([1, 2, 3]);

      // Sync to backend if we have a proposalId and made local updates
      const proposalIdToSync = Number(urlProposalId) || currentProposalId;
      if (needsUpdate && proposalIdToSync) {
        markStepVisitedOnBackend(proposalIdToSync, 1);
        markStepVisitedOnBackend(proposalIdToSync, 2);
        markStepVisitedOnBackend(proposalIdToSync, 3);
      }
    }
  }, [
    searchParams,
    currentProposalId,
    visitedPipelineSteps,
    markStepVisitedOnBackend,
    usePipelineStore,
    setDraftStage,
    setCompletedSteps,
  ]);

  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showScopeModal, setShowScopeModal] = useState<boolean>(false);
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState<boolean>(false);
  const [showStyleVoiceModal, setShowStyleVoiceModal] = useState<boolean>(false);
  const [showSectionsModal, setShowSectionsModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showStickyDownload, setShowStickyDownload] = useState<boolean>(false);

  // Reset isGenerating when landing on review page
  useEffect(() => {
    setIsGenerating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark step 2 as visited when this page loads
  useEffect(() => {
    markStepCompleted(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore scroll position from draft UI state
  useEffect(() => {
    try {
      const uiStateStr = sessionStorage.getItem(DRAFT_UI_STATE_STORAGE_KEY);
      if (uiStateStr) {
        const uiState = JSON.parse(uiStateStr);
        if (uiState.scrollPosition > 0) {
          setTimeout(() => {
            window.scrollTo({
              top: uiState.scrollPosition,
              behavior: "smooth",
            });
          }, 300);
        }
        sessionStorage.removeItem(DRAFT_UI_STATE_STORAGE_KEY);
      }
    } catch {
      // Ignore errors restoring UI state
    }
  }, []);

  // Handle scroll for sticky download button
  useEffect(() => {
    const handleScroll = (): void => {
      const scrolled = window.scrollY > 200;
      setShowStickyDownload(scrolled);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Rebuild filesMeta if empty but we have selectedDocumentIds (using Zustand store)
  useEffect(() => {
    if (proposalData.clientId && clients.length > 0) {
      const currentClient = clients.find((c) => c.id === proposalData.clientId);
      if (
        currentClient &&
        proposalData.filesMeta.length === 0 &&
        proposalData.selectedDocumentIds &&
        proposalData.selectedDocumentIds.length > 0
      ) {
        const rebuiltMeta = currentClient.documents
          .filter((doc) => proposalData.selectedDocumentIds!.includes(Number(doc.id)))
          .map((doc) => ({
            name: doc.name,
            size: doc.sizeBytes > 0 ? doc.sizeBytes : 0,
            type: doc.fileType || "application/pdf",
          }));
        if (rebuiltMeta.length > 0) {
          updateProposalData({ filesMeta: rebuiltMeta });
        }
      }
    }
  }, [
    proposalData.clientId,
    proposalData.selectedDocumentIds,
    proposalData.filesMeta.length,
    clients,
  ]);

  function handleSaveScope(data: {
    title: string;
    clientName: string;
    clientId: number | null;
    description: string;
  }): void {
    logger.info("[ReviewPage] handleSaveScope called", data);
    updateProposalData({
      title: data.title,
      clientName: data.clientName,
      clientId: data.clientId ?? undefined,
      description: data.description,
    });

    // Close modal after a brief delay to ensure state update completes
    setTimeout(() => {
      setShowScopeModal(false);
      toast.success("Client details updated");
    }, 0);
  }

  function handleOpenKnowledgeBase(): void {
    setShowKnowledgeBaseModal(true);
    // Refresh client data in the background so the modal has up-to-date info
    refetchClients();
  }

  async function handleSaveKnowledgeBase(
    selectedIds: string[],
    hasNewUploads: boolean
  ): Promise<void> {
    if (hasNewUploads) {
      await refetchClients();
    }

    // Read fresh clients directly from store after any refetch — avoids stale closure capture
    const freshClients = useClientStore.getState().clients;
    const currentClient = freshClients.find((c) => c.id === proposalData.clientId);
    const newFilesMeta = currentClient
      ? currentClient.documents
          .filter((doc) => selectedIds.includes(String(doc.id)))
          .map((doc) => ({
            name: doc.name,
            size: doc.sizeBytes > 0 ? doc.sizeBytes : 0,
            type: doc.fileType || "application/pdf",
          }))
      : filesMeta; // Preserve existing filesMeta when the client is not in the store

    updateProposalData({
      selectedDocumentIds: selectedIds.map(Number),
      filesMeta: newFilesMeta,
    });

    setShowKnowledgeBaseModal(false);
  }

  function handleSaveStyleVoice(data: {
    tone: ToneOption;
    lengthPreference: LengthOption;
    language: string;
  }): void {
    updateProposalData(data);
    setShowStyleVoiceModal(false);
  }

  function handleSaveSections(
    sections: string[],
    newCustomSections?: Array<{ key: string; label: string; description: string }>
  ): void {
    const existingCustomSections: Array<{ key: string; label: string; description: string }> = [];
    updateProposalData({
      selectedSections: sections,
      customSections: [...existingCustomSections, ...(newCustomSections ?? [])],
    });
    setShowSectionsModal(false);
  }

  function handleSaveTemplate(templateId: string, templateType: string): void {
    // Find the selected template to get its sections
    const selectedTemplate = PROPOSAL_TEMPLATES.find((t: { id: string }) => t.id === templateId);

    if (selectedTemplate) {
      updateProposalData({
        templateId,
        templateType: selectedTemplate.templateType,
        selectedSections: [...selectedTemplate.sections],
      });
      toast.success(`Template updated to ${selectedTemplate.name}`);
    } else {
      updateProposalData({
        templateId,
        templateType: "predefined" as const,
      });
      toast.success("Template updated");
    }

    setShowTemplateModal(false);
  }

  const currentClient = clients.find((c) => c.id === proposalData.clientId);
  // Map API ClientDocument to the shape expected by KnowledgeBaseSelectorModal
  const clientDocuments = useMemo(
    () =>
      (currentClient?.documents || []).map((doc) => ({
        id: String(doc.id),
        name: doc.name,
        size: String(doc.sizeBytes > 0 ? doc.sizeBytes : 0),
        date: doc.createdAt ? formatDate(doc.createdAt) : "",
        status: (doc.status === "error" ? "processing" : doc.status) as "parsed" | "processing",
        fileType: (doc.fileType?.split("/").pop()?.split(".").pop() || "pdf") as
          | "pdf"
          | "docx"
          | "xlsx"
          | "pptx",
        s3FileUrl: doc.s3FileUrl,
      })),
    [currentClient]
  );

  const selectedDocumentIdsMemoized = useMemo(
    () => (proposalData.selectedDocumentIds || []).map(String),
    [proposalData.selectedDocumentIds]
  );

  async function handleGenerate(): Promise<void> {
    // Check if sections are selected
    if (proposalData.selectedSections.length === 0) {
      toast.error("Please select at least one section before generating the proposal");
      return;
    }

    if (!proposalData.clientId || proposalData.clientId === 0) {
      toast.error("Please select a client before generating the proposal");
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");

    // Show immediate feedback to user
    // if (isRegenerating) {
    //   toast.info("Regenerating proposal with updated parameters...");
    // } else {
    //   toast.info("Starting proposal generation...");
    // }

    logger.debug("[ReviewPage] Starting proposal generation with data:", {
      title: proposalData.title,
      clientId: proposalData.clientId,
      sectionsCount: proposalData.selectedSections.length,
      filesCount: proposalData.files.length,
      templateType: proposalData.templateType,
      templateId: proposalData.templateId,
    });

    const generateStartTime = Date.now();

    try {
      // CRITICAL FIX: Call the API to create the proposal
      logger.info("[ReviewPage] Calling generateProposal API at", new Date().toISOString());
      const response = await generateProposal(proposalData);

      const generateEndTime = Date.now();
      const generateDuration = generateEndTime - generateStartTime;

      logger.info("[ReviewPage] Proposal created successfully at", new Date().toISOString(), ":", {
        proposalId: response.id,
        status: response.status,
        generateDurationMs: generateDuration,
      });

      if (generateDuration > 2000) {
        logger.warn(
          "[ReviewPage] WARNING: API call took",
          generateDuration,
          "ms - Backend is likely doing synchronous generation instead of returning immediately"
        );
      }

      // Mark Step 2 as visited when starting generation
      if (response.id) {
        await markStepVisitedOnBackend(response.id, 2);
      }

      // Mark review step completed and set stage to generated
      markStepCompleted(2);
      setDraftStage("review_complete");

      // Update maxStepReached to allow returning to Step 3 from earlier steps
      if (maxStepReached < 3) {
        setMaxStepReached(3);
      }

      // Navigate to Generating screen to show real-time progress
      logger.info(
        "[ReviewPage] Navigating to generating page at",
        new Date().toISOString(),
        "with proposalId:",
        response.id
      );
      router.push(`/generating/${response.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate proposal.";
      setErrorMessage(message);
      setIsGenerating(false);
      toast.error(message);
    }
  }

  const descriptionSnippet = proposalData.description
    ? proposalData.description.slice(0, 120) + (proposalData.description.length > 120 ? "..." : "")
    : "No description provided.";

  const selectedSectionLabels = proposalData.selectedSections.map(
    (key: string) =>
      (proposalData.sectionDisplayNames ?? {})[key] ??
      SECTION_DISPLAY_NAMES[key] ??
      key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
  );

  const estimatedPages = `${proposalData.selectedSections.length * 2}–${proposalData.selectedSections.length * 3} Pages`;

  // Get current template name for display
  const currentTemplate = PROPOSAL_TEMPLATES.find(
    (t: { id: string }) => t.id === proposalData.templateId
  );
  const currentTemplateName =
    currentTemplate?.name ||
    (proposalData.templateType === "scratch"
      ? "Start From Scratch"
      : proposalData.templateType === "recreate"
        ? "Recreate Template"
        : "Custom Template");

  return (
    <PageLayout noPadding>
      <DynamicPipeline
        currentStage={draftStage}
        completedSteps={completedSteps}
        visitedSteps={visitedPipelineSteps}
        visible={true}
        proposalId={currentProposalId ?? generatedProposalId}
        maxStepReached={maxStepReached}
      />
      <div className="page-badge">Phase 05</div>
      <h1 className="page-title">Final Review</h1>
      <p className={`page-subtitle ${styles.reviewPageSubtitle}`}>
        Verify your proposal configuration before the AI architect constructs your final document.
        Everything looks right? Hit Generate.
      </p>

      {errorMessage && <div className={styles.errorAlert}>{errorMessage}</div>}

      {/* Sticky Download Documents Button */}
      {proposalData.filesMeta && proposalData.filesMeta.length > 0 && (
        <div className={`${styles.stickyDownloadBar} ${showStickyDownload ? styles.visible : ""}`}>
          <div className={styles.downloadBarContent}>
            <span className={styles.downloadBarText}>
              {proposalData.filesMeta.length} document{proposalData.filesMeta.length > 1 ? "s" : ""}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => toast.info("Download functionality coming soon")}
            >
              Download All Docs
            </button>
          </div>
        </div>
      )}

      <div className="review-layout">
        {/* Left — Summary Cards */}
        <div className="review-layout-left">
          {/* Client + Style & Voice side by side */}
          <div className="grid-2">
            <div className="review-card">
              <div className="review-card-header">
                <span className="review-card-title">CLIENT</span>
                <button className="link-plain" onClick={() => setShowScopeModal(true)}>
                  Edit
                </button>
              </div>
              <div className="review-field">
                <span className="review-field-label">Proposal Title</span>
                <span className="review-field-value dark-bold">{proposalData.title || "—"}</span>
              </div>
              <div className="review-field">
                <span className="review-field-label">Client Name</span>
                <span className="review-field-value dark-bold">
                  {proposalData.clientName || "—"}
                </span>
              </div>
              <div className="review-field">
                <span className="review-field-label">Strategic Prompt Snippet</span>
                <span className="review-field-value dark-bold">
                  &ldquo;{descriptionSnippet}&rdquo;
                </span>
              </div>
            </div>

            <div className="review-card">
              <div className="review-card-header">
                <span className="review-card-title">STYLE & VOICE</span>
                <button className="link-plain" onClick={() => setShowStyleVoiceModal(true)}>
                  Edit
                </button>
              </div>
              <div className={`flex-row ${styles.badgeRow}`}>
                <span className="badge badge-primary">{proposalData.tone}</span>
                <span className="badge badge-muted">{proposalData.lengthPreference}</span>
                <span className="badge badge-muted">{proposalData.language}</span>
              </div>
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="review-card">
            <div className="review-card-header">
              <span className="review-card-title">KNOWLEDGE BASE</span>
              <button className="link-plain" onClick={handleOpenKnowledgeBase}>
                Edit
              </button>
            </div>
            {proposalData.filesMeta.length > 0 ? (
              <ul className={styles.fileList}>
                {proposalData.filesMeta.map((f: { name: string; size: number }, i: number) => (
                  <li key={i} className={styles.fileItem}>
                    <span className={styles.fileItemName}>{f.name}</span>
                    <span className={styles.fileItemSize}>{formatBytes(f.size)}</span>
                  </li>
                ))}
              </ul>
            ) : isLoadingClients ? (
              <span className="text-muted text-small">Loading documents…</span>
            ) : (proposalData.selectedDocumentIds?.length ?? 0) > 0 ? (
              <span className="text-muted text-small">
                Previously selected documents unavailable — click Edit to reselect
              </span>
            ) : (
              <span className="text-muted text-small">No files uploaded</span>
            )}
            {proposalData.webReferences.length > 0 && (
              <div className={styles.webRefsSection}>
                <span className={`review-field-label ${styles.webRefsLabel}`}>Web References</span>
                {proposalData.webReferences.map((r: string) => (
                  <div key={r} className={styles.webRefUrl}>
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="review-card">
            <div className="review-card-header">
              <span className="review-card-title">INCLUDED SECTIONS</span>
              <button className="link-plain" onClick={() => setShowSectionsModal(true)}>
                Edit
              </button>
            </div>
            <div className={`flex-row ${styles.sectionsBadgeRow}`}>
              {selectedSectionLabels.map((label: string) => (
                <span key={label} className="badge badge-primary">
                  {label}
                </span>
              ))}
              {selectedSectionLabels.length === 0 && (
                <span className="text-muted text-small">No sections selected</span>
              )}
            </div>
          </div>
        </div>
        {/* Right — Launch Panel */}
        <div className="review-layout-right">
          <div className="launch-panel">
            <h2 className="launch-panel-title">Ready to launch?</h2>
            <p className="launch-panel-desc">
              Your proposal configuration is complete. The AI will now generate each section based
              on your inputs. This may take 30–60 seconds.
            </p>

            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={proposalData.selectedSections.length === 0}
              loading={isGenerating}
              className="launch-btn"
            >
              {isGenerating ? "Generating Proposal..." : "Generate Proposal"}
            </Button>

            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={isGenerating}
              className="launch-btn-secondary"
            >
              Save Draft
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showScopeModal && (
        <ScopeEditorModal
          proposalTitle={proposalData.title}
          clientName={proposalData.clientName}
          clientId={proposalData.clientId ?? null}
          description={proposalData.description}
          onClose={() => setShowScopeModal(false)}
          onSave={handleSaveScope}
        />
      )}

      {showKnowledgeBaseModal && (
        <KnowledgeBaseSelectorModal
          availableDocuments={clientDocuments}
          selectedDocumentIds={selectedDocumentIdsMemoized}
          onClose={() => setShowKnowledgeBaseModal(false)}
          onSave={handleSaveKnowledgeBase}
          clientId={proposalData.clientId}
          onRefreshDocuments={async () => {
            await refetchClients();
          }}
        />
      )}

      {showStyleVoiceModal && (
        <StyleVoiceEditorModal
          tone={proposalData.tone}
          lengthPreference={proposalData.lengthPreference}
          language={proposalData.language}
          onClose={() => setShowStyleVoiceModal(false)}
          onSave={handleSaveStyleVoice}
        />
      )}

      {showSectionsModal && (
        <SectionsSelectorModal
          selectedSections={proposalData.selectedSections}
          sectionDisplayNames={proposalData.sectionDisplayNames}
          onClose={() => setShowSectionsModal(false)}
          onSave={handleSaveSections}
        />
      )}

      {showTemplateModal && (
        <TemplateSelectorModal
          currentTemplateId={proposalData.templateId}
          currentTemplateType={proposalData.templateType}
          onClose={() => setShowTemplateModal(false)}
          onSave={handleSaveTemplate}
        />
      )}
    </PageLayout>
  );
}
