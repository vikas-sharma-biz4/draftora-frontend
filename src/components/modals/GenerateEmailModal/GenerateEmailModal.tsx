"use client";

import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { X, Search, ChevronDown, RefreshCw, Save, Copy, FileDown, FileText } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { EMAIL_TEMPLATES } from "@/constants/artifactTemplates";
import { generateArtifact, listArtifacts, updateArtifact } from "@/services/artifact.service";
import { listProposals } from "@/services/proposal.service";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import { formatDate } from "@/utils/dateUtils";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";
import type { ArtifactOptions, GeneratedArtifact } from "@/interfaces/artifactInterfaces";

import styles from "./GenerateEmailModal.module.scss";

// Lazy-load RichEditor — it imports Tiptap which is heavy
const RichEditor = dynamic(() => import("@/components/common/RichEditor"), { ssr: false });

interface GenerateEmailModalProps {
  client: ClientWithDocuments;
  proposals: ProposalListItem[];
  onClose: () => void;
}

type ModalStep = 1 | 2;

const DEFAULT_OPTIONS: ArtifactOptions = {
  includeSummary: true,
  includeScope: true,
  includeStrengths: true,
  includePodcast: true,
};

export default function GenerateEmailModal({
  client,
  onClose,
}: Omit<GenerateEmailModalProps, "proposals">): JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<ModalStep>(1);

  // Step 1 state
  const [clientProposals, setClientProposals] = useState<ProposalListItem[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(true);
  const [proposalSearch, setProposalSearch] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("enterprise_partnership");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [options, setOptions] = useState<ArtifactOptions>(DEFAULT_OPTIONS);

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Step 2 state
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<GeneratedArtifact | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

  const { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf } =
    useArtifactDownload();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch completed proposals for this client directly from the API
  useEffect(() => {
    setIsLoadingProposals(true);
    listProposals({ clientId: client.id })
      .then(setClientProposals)
      .catch((err) => logger.error("[GenerateEmailModal] Failed to load proposals:", err))
      .finally(() => setIsLoadingProposals(false));
  }, [client.id]);

  // Close version dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-version-dropdown]")) {
        setShowVersionDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProposals = clientProposals.filter((p) =>
    p.title.toLowerCase().includes(proposalSearch.toLowerCase())
  );

  const selectedProposal = clientProposals.find((p) => p.id === selectedProposalId) ?? null;

  // Load existing version history when a proposal is selected in step 1
  const loadVersionHistory = useCallback(
    async (proposalId: number): Promise<void> => {
      setIsLoadingHistory(true);
      try {
        const existing = await listArtifacts({
          clientId: client.id,
          proposalId,
          artifactType: "email",
        });
        setArtifacts(existing);
      } catch (err) {
        logger.error("[GenerateEmailModal] Failed to load version history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [client.id]
  );

  function buildTitle(): string {
    const proposalTitle = selectedProposal?.title ?? "Proposal";
    return `Email — ${client.name} — ${proposalTitle}`;
  }

  async function handleGenerate(): Promise<void> {
    if (!selectedProposalId) return;
    setIsGenerating(true);
    // On first generate we jump to step 2 to show the spinner
    setStep(2);
    try {
      const artifact = await generateArtifact({
        clientId: client.id,
        proposalId: selectedProposalId,
        templateId: selectedTemplateId,
        artifactType: "email",
        title: buildTitle(),
        additionalInstructions: additionalInstructions || undefined,
        options,
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      setEditorContent(artifact.content);
    } catch (err) {
      logger.error("[GenerateEmailModal] Generation failed:", err);
      toast.error(MESSAGES.ARTIFACT_GENERATE_FAILED);
      // Return to step 1 on failure so user can try again
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
        templateId: selectedTemplateId,
        artifactType: "email",
        title: buildTitle(),
        additionalInstructions: additionalInstructions || undefined,
        options,
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      setEditorContent(artifact.content);
      toast.success(`Email v${artifact.version} generated`);
    } catch (err) {
      logger.error("[GenerateEmailModal] Regeneration failed:", err);
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
      logger.error("[GenerateEmailModal] Save failed:", err);
      toast.error(MESSAGES.ARTIFACT_SAVE_FAILED);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyContent(): Promise<void> {
    try {
      const plainText =
        new DOMParser().parseFromString(editorContent, "text/html").body.textContent ?? "";
      await navigator.clipboard.writeText(plainText);
      toast.success(MESSAGES.ARTIFACT_COPIED);
    } catch {
      toast.error("Failed to copy content.");
    }
  }

  function handleExportHtml(): void {
    if (!currentArtifact) return;
    const blob = new Blob([editorContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentArtifact.title}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
  }

  function handleSelectVersion(artifact: GeneratedArtifact): void {
    setCurrentArtifact(artifact);
    setEditorContent(artifact.content);
    setShowVersionDropdown(false);
  }

  function toggleOption(key: keyof ArtifactOptions): void {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const subjectLine = (currentArtifact?.metadataJson?.subject as string | undefined) ?? "";

  if (!mounted) return null;

  const content = (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${step === 2 ? styles.modalWide : ""}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Generate Email</span>
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
                onClick={() => {
                  if (artifacts.length > 0) {
                    if (!currentArtifact) {
                      setCurrentArtifact(artifacts[0]);
                      setEditorContent(artifacts[0].content);
                    }
                    setStep(2);
                  }
                }}
                disabled={artifacts.length === 0 || isLoadingHistory}
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

        {/* Body */}
        {step === 1 && (
          <>
            <div className={styles.body}>
              {/* Proposal selection */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>1. Select Proposal</span>
                <div className={styles.proposalSearch}>
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search proposals…"
                    value={proposalSearch}
                    onChange={(e) => setProposalSearch(e.target.value)}
                  />
                </div>
                {isLoadingProposals ? (
                  <div className={styles.emptyState}>Loading proposals…</div>
                ) : filteredProposals.length === 0 ? (
                  <div className={styles.emptyState}>No generated proposals found.</div>
                ) : (
                  <div className={styles.proposalList}>
                    {filteredProposals.map((p) => (
                      <div
                        key={p.id}
                        className={`${styles.proposalCard} ${
                          selectedProposalId === p.id ? styles.selected : ""
                        }`}
                        onClick={() => {
                          if (selectedProposalId !== p.id) {
                            setArtifacts([]);
                            setCurrentArtifact(null);
                          }
                          setSelectedProposalId(p.id);
                          void loadVersionHistory(p.id);
                        }}
                      >
                        <div>
                          <div className={styles.proposalCardTitle}>{p.title}</div>
                          <div className={styles.proposalCardMeta}>
                            {p.templateType} · {formatDate(p.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Template selection */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>2. Email Template</span>
                <div className={styles.templateGrid}>
                  {EMAIL_TEMPLATES.map((t) => (
                    <div
                      key={t.id}
                      className={`${styles.templateCard} ${
                        selectedTemplateId === t.id ? styles.selected : ""
                      }`}
                      onClick={() => setSelectedTemplateId(t.id)}
                    >
                      <div className={styles.templateCardName}>{t.displayName}</div>
                      <div className={styles.templateCardDesc}>{t.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional instructions */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>3. Additional Instructions (Optional)</span>
                <textarea
                  className={styles.textarea}
                  placeholder="e.g. Focus on AI capabilities, mention phased delivery…"
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Content options */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>4. Content Options</span>
                <div className={styles.checkboxRow}>
                  {(
                    [
                      { key: "includeSummary", label: "Include Proposal Summary" },
                      { key: "includeScope", label: "Include High-Level Scope" },
                      { key: "includeStrengths", label: "Include Company Strengths" },
                      { key: "includePodcast", label: "Include Podcast Reference" },
                    ] as const
                  ).map(({ key, label }) => (
                    <label key={key} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={options[key]}
                        onChange={() => toggleOption(key)}
                      />
                      {label}
                    </label>
                  ))}
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
                  disabled={!selectedProposalId}
                >
                  Generate Email →
                </button>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className={styles.body}>
              {isGenerating ? (
                <div className={styles.generatingState}>
                  <span className="spinner" style={{ width: 32, height: 32 }} />
                  <div className={styles.generatingText}>Generating your email…</div>
                  <div className={styles.generatingSubtext}>This usually takes 5–15 seconds</div>
                </div>
              ) : (
                <>
                  {subjectLine && (
                    <div className={styles.subjectRow}>
                      <label>Subject:</label>
                      <span>{subjectLine}</span>
                    </div>
                  )}
                  <div className={styles.editorWrapper}>
                    <RichEditor
                      content={editorContent}
                      onChange={setEditorContent}
                      placeholder="Email content will appear here…"
                    />
                  </div>
                </>
              )}
            </div>

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
                  <button className="btn btn-ghost btn-sm" onClick={() => void handleCopyContent()}>
                    <Copy size={14} />
                    Copy
                  </button>
                </div>
                <div className={styles.footerRight}>
                  <button className="btn btn-ghost btn-sm" onClick={handleExportHtml}>
                    <FileText size={14} />
                    HTML
                  </button>
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
