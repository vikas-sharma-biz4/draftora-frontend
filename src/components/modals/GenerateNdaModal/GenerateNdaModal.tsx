"use client";

import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { useSteppedModal } from "@/hooks/useSteppedModal";
import { X, ChevronDown, RefreshCw, Save, FileDown } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { NDA_TEMPLATES } from "@/constants/artifactTemplates";
import { generateArtifact, listArtifacts, updateArtifact } from "@/services/artifact.service";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import { useClientProposalsQuery } from "@/hooks/useClientProposalsQuery";
import { formatDate } from "@/utils/dateUtils";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";
import type { GeneratedArtifact, NdaFormData } from "@/interfaces/artifactInterfaces";

import styles from "./GenerateNdaModal.module.scss";

const RichEditor = dynamic(() => import("@/components/common/RichEditor"), { ssr: false });

interface GenerateNdaModalProps {
  client: ClientWithDocuments;
  onClose: () => void;
}

const DEFAULT_TEMPLATE_ID = NDA_TEMPLATES[0].id;

export default function GenerateNdaModal({
  client,
  onClose,
}: GenerateNdaModalProps): JSX.Element | null {
  const {
    mounted,
    step,
    setStep,
    showVersionDropdown,
    setShowVersionDropdown,
    isGenerating,
    setIsGenerating,
    isSaving,
    setIsSaving,
  } = useSteppedModal(onClose);

  // NDA is client-specific — auto-select the most recent proposal internally.
  // The backend uses proposal.client_name to fill in the NDA second_party_name.
  const { proposals: clientProposals, isLoading: isLoadingProposals } = useClientProposalsQuery(
    client.id
  );
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);

  const [ndaForm, setNdaForm] = useState<NdaFormData>({
    clientName: client.name ?? "",
    clientCompany: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<GeneratedArtifact | null>(null);
  const [editorContent, setEditorContent] = useState("");

  const { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf } =
    useArtifactDownload();

  // Auto-select the most recent proposal when proposals load
  useEffect(() => {
    if (clientProposals.length > 0 && selectedProposalId === null) {
      setSelectedProposalId(clientProposals[0].id);
    }
  }, [clientProposals, selectedProposalId]);

  const loadVersionHistory = useCallback(async (): Promise<void> => {
    try {
      const existing = await listArtifacts({
        clientId: client.id,
        artifactType: "nda",
      });
      setArtifacts(existing);
    } catch (err) {
      logger.error("[GenerateNdaModal] Failed to load version history:", err);
    }
  }, [client.id]);

  // Load existing NDA version history on mount
  useEffect(() => {
    void loadVersionHistory();
  }, [loadVersionHistory]);

  function isNdaFormValid(): boolean {
    return (
      ndaForm.clientName.trim() !== "" &&
      ndaForm.clientCompany.trim() !== "" &&
      ndaForm.date.trim() !== ""
    );
  }

  function buildTitle(): string {
    return `NDA — ${client.name}`;
  }

  async function handleGenerate(): Promise<void> {
    if (!selectedProposalId || !isNdaFormValid()) return;
    setIsGenerating(true);
    setStep(2);
    try {
      const artifact = await generateArtifact({
        clientId: client.id,
        proposalId: selectedProposalId,
        templateId: DEFAULT_TEMPLATE_ID,
        artifactType: "nda",
        title: buildTitle(),
        ndaMetadata: ndaForm,
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      setEditorContent(artifact.content);
    } catch (err) {
      logger.error("[GenerateNdaModal] Generation failed:", err);
      toast.error(MESSAGES.ARTIFACT_GENERATE_FAILED);
      setStep(1);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRegenerate(): Promise<void> {
    if (!selectedProposalId) return;
    setIsGenerating(true);
    try {
      const artifact = await generateArtifact({
        clientId: client.id,
        proposalId: selectedProposalId,
        templateId: DEFAULT_TEMPLATE_ID,
        artifactType: "nda",
        title: buildTitle(),
        ndaMetadata: ndaForm,
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      setEditorContent(artifact.content);
      toast.success(`NDA v${artifact.version} generated`);
    } catch (err) {
      logger.error("[GenerateNdaModal] Regeneration failed:", err);
      toast.error(MESSAGES.ARTIFACT_GENERATE_FAILED);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveDraft(): Promise<void> {
    if (!currentArtifact) return;
    setIsSaving(true);
    try {
      const updated = await updateArtifact(currentArtifact.id, { content: editorContent });
      setCurrentArtifact(updated);
      setArtifacts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast.success(MESSAGES.ARTIFACT_SAVED);
    } catch (err) {
      logger.error("[GenerateNdaModal] Save failed:", err);
      toast.error(MESSAGES.ARTIFACT_SAVE_FAILED);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSelectVersion(artifact: GeneratedArtifact): void {
    setCurrentArtifact(artifact);
    setEditorContent(artifact.content);
    setShowVersionDropdown(false);
  }

  if (!mounted) return null;

  const content = (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nda-modal-title"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title} id="nda-modal-title">
              Generate NDA
            </span>
            <nav className={styles.stepNav} aria-label="Steps">
              <button
                className={`${styles.stepNavItem} ${step === 1 ? styles.stepNavItemActive : ""}`}
                onClick={() => setStep(1)}
              >
                Step 1
              </button>
              <span className={styles.stepNavSep}>›</span>
              <button
                className={`${styles.stepNavItem} ${step === 2 ? styles.stepNavItemActive : ""}`}
                onClick={() => currentArtifact && setStep(2)}
                disabled={!currentArtifact}
              >
                Step 2
              </button>
            </nav>
            {step === 2 && currentArtifact && (
              <div
                className={styles.versionBadge}
                data-version-dropdown
                onClick={() => setShowVersionDropdown((v) => !v)}
              >
                v{currentArtifact.version} <ChevronDown size={12} />
                {showVersionDropdown && artifacts.length > 0 && (
                  <div className={styles.versionDropdown}>
                    {artifacts.map((a) => (
                      <div
                        key={a.id}
                        className={`${styles.versionDropdownItem} ${
                          a.id === currentArtifact.id ? styles.active : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectVersion(a);
                        }}
                      >
                        <span>v{a.version}</span>
                        <span className={styles.versionMeta}>{formatDate(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Step 1 — client-specific NDA, second party details form */}
        {step === 1 && (
          <>
            <div className={styles.body}>
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Client</span>
                <div className={styles.templateCardSingle}>
                  <div className={styles.templateCardName}>{client.name}</div>
                  {client.industry && (
                    <div className={styles.templateCardDesc}>{client.industry}</div>
                  )}
                </div>
              </div>

              <div className={styles.section}>
                <span className={styles.sectionLabel}>Second Party Details</span>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor="nda-client-name">
                      Client Name
                    </label>
                    <input
                      id="nda-client-name"
                      className={styles.formInput}
                      type="text"
                      value={ndaForm.clientName}
                      onChange={(e) => setNdaForm((f) => ({ ...f, clientName: e.target.value }))}
                      placeholder="Enter client name"
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor="nda-client-company">
                      Client Company
                    </label>
                    <input
                      id="nda-client-company"
                      className={styles.formInput}
                      type="text"
                      value={ndaForm.clientCompany}
                      onChange={(e) => setNdaForm((f) => ({ ...f, clientCompany: e.target.value }))}
                      placeholder="Enter company name"
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor="nda-date">
                      Effective Date
                    </label>
                    <input
                      id="nda-date"
                      className={styles.formInput}
                      type="date"
                      value={ndaForm.date}
                      onChange={(e) => setNdaForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <span className={styles.sectionLabel}>NDA Template</span>
                <div className={styles.templateCardSingle}>
                  <div className={styles.templateCardName}>{NDA_TEMPLATES[0].displayName}</div>
                  <div className={styles.templateCardDesc}>{NDA_TEMPLATES[0].description}</div>
                </div>
              </div>
            </div>

            <div className={styles.footer}>
              <div className={styles.footerLeft} />
              <div className={styles.footerRight}>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleGenerate()}
                  disabled={isLoadingProposals || !selectedProposalId || !isNdaFormValid()}
                >
                  {isLoadingProposals ? "Loading…" : "Generate NDA →"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2 — editor / preview */}
        {step === 2 && (
          <>
            {isGenerating ? (
              <div className={styles.body}>
                <div className={styles.generatingState}>
                  <span className="spinner" style={{ width: 32, height: 32 }} />
                  <div className={styles.generatingText}>Generating your NDA…</div>
                  <div className={styles.generatingSubtext}>This usually takes a few seconds</div>
                </div>
              </div>
            ) : (
              <div className={styles.previewBody}>
                <div className={styles.previewBodyLabel}>Preview</div>
                <div className={styles.previewBodyScroll}>
                  <RichEditor
                    content={editorContent}
                    onChange={setEditorContent}
                    placeholder="NDA content will appear here…"
                  />
                </div>
              </div>
            )}

            {!isGenerating && (
              <div className={styles.footer}>
                <div className={styles.footerLeft}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void handleRegenerate()}
                    disabled={isGenerating}
                  >
                    <RefreshCw size={14} />
                    Regenerate
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void handleSaveDraft()}
                    disabled={isSaving}
                  >
                    <Save size={14} />
                    {isSaving ? "Saving…" : "Save Draft"}
                  </button>
                </div>
                <div className={styles.footerRight}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      currentArtifact &&
                      void downloadArtifact(currentArtifact.id, currentArtifact.title)
                    }
                    disabled={isDownloading}
                  >
                    <FileDown size={14} />
                    {isDownloading ? "…" : "DOCX"}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      currentArtifact &&
                      void downloadArtifactPdf(currentArtifact.id, currentArtifact.title)
                    }
                    disabled={isPdfDownloading}
                  >
                    <FileDown size={14} />
                    {isPdfDownloading ? "…" : "PDF"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
