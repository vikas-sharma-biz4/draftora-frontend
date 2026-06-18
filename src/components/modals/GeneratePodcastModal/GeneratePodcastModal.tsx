"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, useCallback } from "react";
import { X, Search, ChevronDown, RefreshCw, Save, Copy } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { PODCAST_TEMPLATES } from "@/constants/artifactTemplates";
import { generateArtifact, listArtifacts, updateArtifact } from "@/services/artifact.service";
import { useClientProposalsQuery } from "@/hooks/useClientProposalsQuery";
import { formatDate } from "@/utils/dateUtils";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";

import styles from "./GeneratePodcastModal.module.scss";

interface GeneratePodcastModalProps {
  client: ClientWithDocuments;
  onClose: () => void;
  initialProposalId?: number;
}

type ModalStep = 1 | 2;

export default function GeneratePodcastModal({
  client,
  onClose,
  initialProposalId,
}: GeneratePodcastModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<ModalStep>(1);

  // ── Step 1 state ─────────────────────────────────────────────────────────
  const {
    proposals: clientProposals,
    isLoading: isLoadingProposals,
    isError: isProposalsError,
  } = useClientProposalsQuery(client.id);
  const [proposalSearch, setProposalSearch] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(
    initialProposalId ?? null
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(PODCAST_TEMPLATES[0].id);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // ── Step 2 state ─────────────────────────────────────────────────────────
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<GeneratedArtifact | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When opened from a specific proposal, auto-load its version history
  useEffect(() => {
    if (initialProposalId) {
      void loadVersionHistory(initialProposalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const loadVersionHistory = useCallback(
    async (proposalId: number): Promise<void> => {
      setIsLoadingHistory(true);
      try {
        const existing = await listArtifacts({
          clientId: client.id,
          proposalId,
          artifactType: "podcast",
        });
        setArtifacts(existing);
      } catch (err) {
        logger.error("[GeneratePodcastModal] Failed to load version history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [client.id]
  );

  function buildTitle(): string {
    const proposalTitle = selectedProposal?.title ?? "Proposal";
    return `NotebookLM Prompt — ${client.name} — ${proposalTitle}`;
  }

  async function handleGenerate(): Promise<void> {
    if (!selectedProposalId) return;
    setIsGenerating(true);
    setStep(2);
    try {
      const artifact = await generateArtifact({
        clientId: client.id,
        proposalId: selectedProposalId,
        templateId: selectedTemplateId,
        artifactType: "podcast",
        title: buildTitle(),
        additionalInstructions: additionalInstructions || undefined,
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      setEditorContent(artifact.content);
    } catch (err) {
      logger.error("[GeneratePodcastModal] Generation failed:", err);
      toast.error(MESSAGES.PODCAST_GENERATE_FAILED);
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
        artifactType: "podcast",
        title: buildTitle(),
        additionalInstructions: additionalInstructions || undefined,
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      setEditorContent(artifact.content);
      toast.success(`Podcast prompt v${artifact.version} generated`);
    } catch (err) {
      logger.error("[GeneratePodcastModal] Regeneration failed:", err);
      toast.error(MESSAGES.PODCAST_GENERATE_FAILED);
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
      logger.error("[GeneratePodcastModal] Save failed:", err);
      toast.error(MESSAGES.ARTIFACT_SAVE_FAILED);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyPrompt(): Promise<void> {
    if (!currentArtifact) return;
    try {
      await navigator.clipboard.writeText(currentArtifact.content);
      toast.success(MESSAGES.ARTIFACT_COPIED);
    } catch {
      toast.error("Failed to copy prompt.");
    }
  }

  function handleSelectVersion(artifact: GeneratedArtifact): void {
    setCurrentArtifact(artifact);
    setEditorContent(artifact.content);
    setShowVersionDropdown(false);
  }

  if (!mounted) return null;

  const content = (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget}>
      <div className={`${styles.modal} ${step === 2 ? styles.modalWide : ""}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Generate Podcast Prompt</span>
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

        {/* ── Step 1 ── */}
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
                ) : isProposalsError ? (
                  <div className={styles.emptyState}>
                    Failed to load proposals. Please try again.
                  </div>
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
                <span className={styles.sectionLabel}>2. Prompt Template</span>
                <div className={styles.templateGrid}>
                  {PODCAST_TEMPLATES.map((t) => (
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
                  placeholder="e.g. Focus on the AI modules, keep it under 10 minutes…"
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  rows={3}
                />
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
                  Generate Prompt →
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <>
            <div className={styles.body}>
              {isGenerating ? (
                <div className={styles.generatingState}>
                  <span className="spinner" style={{ width: 32, height: 32 }} />
                  <div className={styles.generatingText}>Generating your podcast prompt…</div>
                  <div className={styles.generatingSubtext}>This usually takes 5–15 seconds</div>
                </div>
              ) : (
                <div className={styles.promptWrapper}>
                  <textarea
                    className={styles.promptTextarea}
                    value={editorContent}
                    readOnly
                    placeholder="Your NotebookLM prompt will appear here…"
                  />
                </div>
              )}
            </div>

            {!isGenerating && (
              <div className={styles.footer}>
                <div className={styles.footerLeft}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleRegenerate()}
                    disabled={isGenerating}
                  >
                    <RefreshCw size={14} />
                    Regenerate
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleSaveDraft()}
                    disabled={isSaving}
                  >
                    <Save size={14} />
                    {isSaving ? "Saving…" : "Save Draft"}
                  </button>
                </div>
                <div className={styles.footerRight}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleCopyPrompt()}
                    disabled={!currentArtifact}
                  >
                    <Copy size={14} />
                    Copy Prompt
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
