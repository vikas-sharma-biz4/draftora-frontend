"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import styles from "./page.module.scss";

import { generateProposal } from "@/services/proposalApi";
import { SECTION_DISPLAY_NAMES, PROPOSAL_TEMPLATES } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";
import { useClients } from "@/hooks/useClients";
import { formatBytes } from "@/utils/formatBytes";
import { formatDate } from "@/utils/dateUtils";

const PageLayout = dynamic(() => import("@/components/common/PageLayout"), { ssr: false });

const DynamicPipeline = dynamic(() => import("@/components/common/DynamicPipeline"), {
  ssr: false,
});

const ScopeEditorModal = dynamic(() => import("@/components/modals/ScopeEditorModal"), {
  ssr: false,
});

const KnowledgeBaseSelectorModal = dynamic(() => import("@/components/modals/KnowledgeBaseSelectorModal"), {
  ssr: false,
});

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
  const {
    proposalData,
    updateProposalData,
    setCurrentStep,
    isGenerating,
    setIsGenerating,
    setGeneratedProposalId,
    setDraftStage,
    markStepCompleted,
    setCompletedSteps,
    currentProposalId,
    draftStage,
    completedSteps,
    visitedPipelineSteps,
    syncVisitedStepsFromBackend,
    markStepVisitedOnBackend,
  } = useProposal();
  const router = useRouter();
  const handleSaveDraft = useSaveDraft();
  const isRegenerating = currentProposalId !== null;
  const { clients, refetch: refetchClients } = useClients({ autoFetch: true });

  // Enable auto-save to localStorage drafts when user is in pipeline stage
  useDraftAutoSave({ enabled: true });

  // Sync visited steps from backend on mount
  useEffect(() => {
    if (currentProposalId) {
      syncVisitedStepsFromBackend(currentProposalId);
    }
  }, [currentProposalId, syncVisitedStepsFromBackend]);
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
  }, [setIsGenerating]);

  // Mark step 2 as visited when this page loads
  useEffect(() => {
    markStepCompleted(2);
  }, [markStepCompleted]);

  // Restore scroll position from draft UI state
  useEffect(() => {
    try {
      const uiStateStr = sessionStorage.getItem("draft_ui_state");
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
        sessionStorage.removeItem("draft_ui_state");
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
      if (currentClient && proposalData.filesMeta.length === 0 && proposalData.selectedDocumentIds && proposalData.selectedDocumentIds.length > 0) {
        const rebuiltMeta = currentClient.documents
          .filter((doc) => proposalData.selectedDocumentIds!.includes(Number(doc.id)))
          .map((doc) => ({
            name: doc.name,
            size: doc.size_bytes || 0,
            type: doc.file_type || "application/pdf",
          }));
        if (rebuiltMeta.length > 0) {
          updateProposalData({ filesMeta: rebuiltMeta });
        }
      }
    }
  }, [proposalData.clientId, clients]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaveScope(data: { title: string; clientName: string; description: string }): void {
    updateProposalData({
      title: data.title,
      clientName: data.clientName,
      description: data.description,
    });
    setShowScopeModal(false);
  }

  async function handleSaveKnowledgeBase(selectedIds: string[]): Promise<void> {
    // Rebuild filesMeta from selected documents using Zustand store
    const currentClient = clients.find((c) => c.id === proposalData.clientId);
    const newFilesMeta = currentClient
      ? currentClient.documents
          .filter((doc) => selectedIds.includes(String(doc.id)))
          .map((doc) => ({
            name: doc.name,
            size: doc.size_bytes || 0,
            type: doc.file_type || "application/pdf",
          }))
      : [];

    updateProposalData({
      selectedDocumentIds: selectedIds.map(Number),
      filesMeta: newFilesMeta,
    });
    
    // Refresh clients from API to get newly uploaded documents
    await refetchClients();
    setShowKnowledgeBaseModal(false);
  }

  function handleSaveStyleVoice(data: { tone: string; lengthPreference: string; language: string }): void {
    updateProposalData(data);
    setShowStyleVoiceModal(false);
  }

  function handleSaveSections(sections: string[]): void {
    updateProposalData({
      selectedSections: sections,
    });
    setShowSectionsModal(false);
  }

  function handleSaveTemplate(templateId: string, templateType: string): void {
    // Find the selected template to get its sections
    const selectedTemplate = PROPOSAL_TEMPLATES.find((t: { id: string }) => t.id === templateId);
    
    if (selectedTemplate) {
      updateProposalData({
        templateId,
        templateType: "predefined" as const,
        selectedSections: [...selectedTemplate.sections],
      });
      toast.success(`Template updated to ${selectedTemplate.name}`);
    } else {
      updateProposalData({
        templateId,
        templateType: "predefined" as const,
      });
      toast.success("Template updated successfully");
    }
    
    setShowTemplateModal(false);
  }

  const currentClient = clients.find((c) => c.id === proposalData.clientId);
  // Map API ClientDocument to the shape expected by KnowledgeBaseSelectorModal
  const clientDocuments = (currentClient?.documents || []).map((doc) => ({
    id: String(doc.id),
    name: doc.name,
    size: String(doc.size_bytes || 0),
    date: doc.created_at ? formatDate(doc.created_at) : "",
    status: (doc.status === "error" ? "processing" : doc.status) as "parsed" | "processing",
    fileType: (doc.file_type?.split("/").pop()?.split(".").pop() || "pdf") as "pdf" | "docx" | "xlsx" | "pptx",
  }));

  async function handleGenerate(): Promise<void> {
    setIsGenerating(true);
    setErrorMessage("");
    
    // Show immediate feedback to user
    if (isRegenerating) {
      toast.info("Regenerating proposal with updated parameters...");
    } else {
      toast.info("Starting proposal generation...");
    }
    
    try {
      const result = await generateProposal(proposalData);
      setGeneratedProposalId(result.id);
      
      // Mark Step 2 as visited when starting generation
      if (result.id) {
        await markStepVisitedOnBackend(result.id, 2);
      }
      
      // Mark review step completed and set stage to generated
      markStepCompleted(2);
      setDraftStage("review_complete");
      
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

  // Get current template name for display
  const currentTemplate = PROPOSAL_TEMPLATES.find((t: { id: string }) => t.id === proposalData.templateId);
  const currentTemplateName = currentTemplate?.name || (proposalData.templateType === "scratch" ? "Start From Scratch" : proposalData.templateType === "recreate" ? "Recreate Template" : "Custom Template");

  return (
    <PageLayout noPadding>
        <DynamicPipeline 
          currentStage={draftStage}
          completedSteps={completedSteps}
          visitedSteps={visitedPipelineSteps}
          visible={true}
          proposalId={currentProposalId}
        />
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

        {/* Sticky Download Documents Button */}
        {proposalData.filesMeta && proposalData.filesMeta.length > 0 && (
          <div className={`${styles.stickyDownloadBar} ${showStickyDownload ? styles.visible : ""}`}>
            <div className={styles.downloadBarContent}>
              <span className={styles.downloadBarText}>
                {proposalData.filesMeta.length} document{proposalData.filesMeta.length > 1 ? "s" : ""} uploaded
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => toast.info("Download functionality coming soon")}
              >
                📥 Download All Docs
              </button>
            </div>
          </div>
        )}

        <div className="review-layout">
          {/* Left — Summary Cards */}
          <div className="review-layout-left">
            {/* Client + Style & Voice side by side */}
            <div className="grid-2">
              {/* Template */}
              <div className="review-card">
                <div className="review-card-header">
                  <span className="review-card-title">TEMPLATE</span>
                  <button
                    className="link-plain"
                    onClick={() => setShowTemplateModal(true)}
                  >
                    Edit
                  </button>
                </div>
                <div className="review-field">
                  <span className="review-field-label">Selected Template</span>
                  <span className="review-field-value dark-bold">
                    {currentTemplateName}
                  </span>
                </div>
                <div className="review-field">
                  <span className="review-field-label">Template ID</span>
                  <span className="review-field-value">
                    {proposalData.templateId || "—"}
                  </span>
                </div>
              </div>

              <div className="review-card">
                <div className="review-card-header">
                  <span className="review-card-title">CLIENT</span>
                  <button
                    className="link-plain"
                    onClick={() => setShowScopeModal(true)}
                  >
                    Edit
                  </button>
                </div>
                <div className="review-field">
                  <span className="review-field-label">Proposal Title</span>
                  <span className="review-field-value dark-bold">
                    {proposalData.title || "—"}
                  </span>
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
                    "{descriptionSnippet}"
                  </span>
                </div>
              </div>

              <div className="review-card">
                <div className="review-card-header">
                  <span className="review-card-title">STYLE & VOICE</span>
                  <button
                    className="link-plain"
                    onClick={() => setShowStyleVoiceModal(true)}
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

            {/* Knowledge Base */}
            <div className="review-card">
              <div className="review-card-header">
                <span className="review-card-title">KNOWLEDGE BASE</span>
                <button
                  className="link-plain"
                  onClick={() => setShowKnowledgeBaseModal(true)}
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

            {/* Sections */}
            <div className="review-card">
              <div className="review-card-header">
                <span className="review-card-title">
                  INCLUDED SECTIONS
                </span>
                <button
                  className="link-plain"
                  onClick={() => setShowSectionsModal(true)}
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
          <div className="review-layout-right">
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
                "Generate Proposal"
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
        </div>

        <div className="page-footer">
          <div className="page-footer-left">
            <button
              className="btn btn-ghost"
              onClick={() => router.push("/parameters")}
            >
              ← Back
            </button>
          </div>
          <div className="page-footer-right">
            <button className="btn btn-secondary" onClick={handleSaveDraft}>
              Save Draft
            </button>
          </div>
        </div>

        {/* Modals */}
        {showScopeModal && (
          <ScopeEditorModal
            proposalTitle={proposalData.title}
            clientName={proposalData.clientName}
            description={proposalData.description}
            onClose={() => setShowScopeModal(false)}
            onSave={handleSaveScope}
            onNewClient={() => {
              setShowScopeModal(false);
              toast.info("New client creation not implemented yet");
            }}
          />
        )}

        {showKnowledgeBaseModal && (
          <KnowledgeBaseSelectorModal
            availableDocuments={clientDocuments}
            selectedDocumentIds={(proposalData.selectedDocumentIds || []).map(String)}
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
