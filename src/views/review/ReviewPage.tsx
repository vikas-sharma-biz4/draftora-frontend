"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { FileText, Sparkles } from "lucide-react";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import Button from "@/components/common/Button";

import styles from "./ReviewPage.module.scss";

import { generateProposal } from "@/services/proposal.service";
import { SECTION_DISPLAY_NAMES, PROPOSAL_TEMPLATES } from "@/constants";
import { useProposalWizard, useProposalPipeline, useProposalDraftSession } from "@/context/ProposalContext";
import type { ToneOption, LengthOption } from "@/interfaces/proposalInterfaces";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { useWizardAutoSave } from "@/hooks/useWizardAutoSave";
import { useClients } from "@/hooks/useClients";
import { formatBytes } from "@/utils/formatBytes";
import { formatDate } from "@/utils/dateUtils";

const PageLayout = dynamic(() => import("@/layouts/AppLayout"), { ssr: false });

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
    currentProposalId,
    maxStepReached,
    setMaxStepReached,
  } = useProposalWizard();
  const { visitedPipelineSteps, syncVisitedStepsFromBackend, markStepVisitedOnBackend } = useProposalPipeline();
  const { draftStage, completedSteps, setDraftStage, markStepCompleted, setCompletedSteps } = useProposalDraftSession();
  const router = useRouter();
  const handleSaveDraft = useSaveDraft();
  const isRegenerating = currentProposalId !== null;
  const { clients, refetch: refetchClients } = useClients({ autoFetch: true });

  // Enable auto-save when user is in pipeline stage
  useWizardAutoSave({ enabled: true, debounceMs: 2000 });

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
            size: doc.sizeBytes || 0,
            type: doc.fileType || "application/pdf",
          }));
        if (rebuiltMeta.length > 0) {
          updateProposalData({ filesMeta: rebuiltMeta });
        }
      }
    }
  }, [proposalData.clientId, clients]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaveScope(data: { title: string; clientName: string; description: string }): void {
    logger.info('[ReviewPage] handleSaveScope called', data);
    updateProposalData({
      title: data.title,
      clientName: data.clientName,
      description: data.description,
    });
    
    // Close modal after a brief delay to ensure state update completes
    setTimeout(() => {
      setShowScopeModal(false);
      toast.success("Client details updated successfully");
    }, 0);
  }

  async function handleSaveKnowledgeBase(selectedIds: string[]): Promise<void> {
    // First refresh clients to get the latest documents (including newly uploaded)
    await refetchClients();

    // Then rebuild filesMeta from selected documents using refreshed client data
    const currentClient = clients.find((c) => c.id === proposalData.clientId);
    const newFilesMeta = currentClient
      ? currentClient.documents
          .filter((doc) => selectedIds.includes(String(doc.id)))
          .map((doc) => ({
            name: doc.name,
            size: doc.sizeBytes || 0,
            type: doc.fileType || "application/pdf",
          }))
      : [];

    updateProposalData({
      selectedDocumentIds: selectedIds.map(Number),
      filesMeta: newFilesMeta,
    });

    setShowKnowledgeBaseModal(false);
    toast.success(`${selectedIds.length} document(s) selected for Knowledge Base`);
  }

  function handleSaveStyleVoice(data: { tone: ToneOption; lengthPreference: LengthOption; language: string }): void {
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
    size: String(doc.sizeBytes || 0),
    date: doc.createdAt ? formatDate(doc.createdAt) : "",
    status: (doc.status === "error" ? "processing" : doc.status) as "parsed" | "processing",
    fileType: (doc.fileType?.split("/").pop()?.split(".").pop() || "pdf") as "pdf" | "docx" | "xlsx" | "pptx",
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

    // Continue API call
    try {
      const result = await generateProposal(proposalData);
      setGeneratedProposalId(result.id);

      // Store the ID and update status
      sessionStorage.setItem("pending_proposal_id", result.id.toString());
      sessionStorage.setItem("generation_status", "started");
      
      // Navigate to generating screen with proposal ID
      router.push(`/generating/${result.id}`);

      // Mark Step 2 as visited when starting generation
      if (result.id) {
        await markStepVisitedOnBackend(result.id, 2);
      }

      // Mark review step completed and set stage to generated
      markStepCompleted(2);
      setDraftStage("review_complete");

      // Update maxStepReached to allow returning to Step 3 from earlier steps
      if (maxStepReached < 3) {
        setMaxStepReached(3);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate proposal.";
      setErrorMessage(message);
      setIsGenerating(false);
      sessionStorage.removeItem("pending_proposal_id");
      sessionStorage.removeItem("generation_status");
      toast.error(message);
      router.push("/review");
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
          maxStepReached={maxStepReached}
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

              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={proposalData.selectedSections.length === 0}
                loading={isGenerating}
                className="launch-btn"
              >
                {isGenerating ? (
                  <>
                    <Sparkles size={18} className="sparkle-icon" />
                    Generating Proposal...
                  </>
                ) : (
                  "Generate Proposal"
                )}
              </Button>

              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={isGenerating}
                className="launch-btn-secondary"
              >
                Save Draft
              </Button>

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
            <Button
              variant="ghost"
              onClick={() => router.push("/parameters")}
            >
              Back
            </Button>
          </div>
          <div className="page-footer-right">
            <Button variant="secondary" onClick={handleSaveDraft}>
              Save Draft
            </Button>
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
