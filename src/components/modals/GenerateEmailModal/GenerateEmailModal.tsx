"use client";

import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { useSteppedModal } from "@/hooks/useSteppedModal";
import { X, Search, ChevronDown, Copy, FileDown, RefreshCw, Wand2 } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { generateArtifact, listArtifacts, updateArtifact } from "@/services/artifact.service";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import { useClientProposalsQuery } from "@/hooks/useClientProposalsQuery";
import { formatDate } from "@/utils/dateUtils";
import { fixProposalLinks } from "@/utils/emailUtils";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";

import styles from "./GenerateEmailModal.module.scss";

// Lazy-load RichEditor — it imports Tiptap which is heavy
const RichEditor = dynamic(() => import("@/components/common/RichEditor"), { ssr: false });

interface GenerateEmailModalProps {
  client: ClientWithDocuments;
  onClose: () => void;
  initialProposalId?: number;
  onEmailGenerated?: () => void;
}

export default function GenerateEmailModal({
  client,
  onClose,
  initialProposalId,
  onEmailGenerated,
}: GenerateEmailModalProps): JSX.Element | null {
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

  // Step 1 state
  const {
    proposals: clientProposals,
    isLoading: isLoadingProposals,
    isError: isProposalsError,
  } = useClientProposalsQuery(client.id);
  const [proposalSearch, setProposalSearch] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(
    initialProposalId ?? null
  );
  const [selectedTemplateId] = useState("professional_outreach");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Regenerate instructions inline prompt (step 2)
  const [showRegenInput, setShowRegenInput] = useState<boolean>(false);
  const [regenInstructions, setRegenInstructions] = useState<string>("");

  // Step 2 state
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<GeneratedArtifact | null>(null);
  const [editorContent, setEditorContent] = useState("");

  const { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf } =
    useArtifactDownload();

  // When opened from a specific proposal, auto-load its version history
  useEffect(() => {
    if (initialProposalId) {
      void loadVersionHistory(initialProposalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function callGenerateArtifact(isInitial: boolean, regenNote?: string): Promise<void> {
    setIsGenerating(true);
    if (isInitial) setStep(2);
    try {
      // Merge Step 1 instructions with any per-regeneration notes
      const combinedInstructions =
        [additionalInstructions, regenNote]
          .map((s) => s?.trim())
          .filter(Boolean)
          .join("\n\nAdditional regeneration notes: ") || undefined;

      const artifact = await generateArtifact({
        clientId: client.id,
        proposalId: selectedProposalId ?? undefined,
        templateId: selectedTemplateId,
        artifactType: "email",
        title: buildTitle(),
        additionalInstructions: combinedInstructions,
        clientName: client.name,
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      const generatedHtml = sanitizeHtml(artifact.content);
      setEditorContent(
        artifact.proposalId !== null
          ? fixProposalLinks(generatedHtml, artifact.proposalId)
          : generatedHtml
      );
      if (isInitial) onEmailGenerated?.();
      if (!isInitial) toast.success(`Email v${artifact.version} generated`);
    } catch (err) {
      logger.error("[GenerateEmailModal] Generation failed:", err);
      toast.error(MESSAGES.ARTIFACT_GENERATE_FAILED);
      if (isInitial) setStep(1);
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
      const doc = new DOMParser().parseFromString(editorContent, "text/html");

      // Strip <a> tags that have no genuine absolute URL — they appear colored but
      // are not navigable when pasted into email clients.
      doc.querySelectorAll("a").forEach((a) => {
        const href = (a.getAttribute("href") ?? "").trim();
        const isAbsolute =
          (href.startsWith("http://") || href.startsWith("https://")) &&
          !href.includes("[") &&
          !href.includes("]");
        if (!isAbsolute) {
          const frag = document.createDocumentFragment();
          while (a.firstChild) frag.appendChild(a.firstChild);
          a.replaceWith(frag);
        }
      });

      const htmlForClipboard = doc.body.innerHTML;
      const plainText = doc.body.textContent ?? "";

      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([htmlForClipboard], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
      toast.success(MESSAGES.ARTIFACT_COPIED);
    } catch {
      toast.error("Failed to copy content.");
    }
  }

  function handleSelectVersion(artifact: GeneratedArtifact): void {
    setCurrentArtifact(artifact);
    const versionHtml = sanitizeHtml(artifact.content);
    setEditorContent(
      artifact.proposalId !== null
        ? fixProposalLinks(versionHtml, artifact.proposalId)
        : versionHtml
    );
    setShowVersionDropdown(false);
  }

  const subjectLine = (currentArtifact?.metadataJson?.subject as string | undefined) ?? "";

  if (!mounted) return null;

  const content = (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.modal} ${step === 2 ? styles.modalWide : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-modal-title"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title} id="email-modal-title">
              Generate Email
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

              {/* Additional instructions */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>2. Additional Instructions (Optional)</span>
                <textarea
                  className={styles.textarea}
                  placeholder="e.g. Focus on AI capabilities, mention phased delivery…"
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
                  onClick={() => void callGenerateArtifact(true)}
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
                <div className={styles.editorWrapper}>
                  <RichEditor
                    content={editorContent}
                    onChange={setEditorContent}
                    placeholder="Email content will appear here…"
                  />
                </div>
              )}
            </div>

            {/* Regen prompt bar — slides in between editor and footer */}
            {showRegenInput && !isGenerating && (
              <div className={styles.regenBar}>
                <Wand2 size={15} className={styles.regenBarIcon} />
                <input
                  className={styles.regenBarInput}
                  type="text"
                  placeholder="What would you like to change? (optional — press Enter to generate)"
                  value={regenInstructions}
                  onChange={(e) => setRegenInstructions(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setShowRegenInput(false);
                      void callGenerateArtifact(false, regenInstructions || undefined);
                      setRegenInstructions("");
                    }
                    if (e.key === "Escape") {
                      setShowRegenInput(false);
                      setRegenInstructions("");
                    }
                  }}
                />
                <span className={styles.regenBarOptional}>optional</span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setShowRegenInput(false);
                    void callGenerateArtifact(false, regenInstructions || undefined);
                    setRegenInstructions("");
                  }}
                >
                  Generate
                </button>
                <button
                  className={styles.regenBarDismiss}
                  onClick={() => {
                    setShowRegenInput(false);
                    setRegenInstructions("");
                  }}
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {!isGenerating && (
              <div className={styles.footer}>
                <div className={styles.footerLeft}>
                  <button
                    className={`btn btn-secondary btn-sm${showRegenInput ? ` ${styles.regenBtnActive}` : ""}`}
                    onClick={() => setShowRegenInput((v) => !v)}
                    disabled={isGenerating}
                  >
                    <RefreshCw size={13} />
                    Regenerate
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleCopyContent()}
                    aria-label="Copy email content"
                  >
                    <Copy size={14} />
                    Copy
                  </button>
                </div>
                <div className={styles.footerRight}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      currentArtifact &&
                      void downloadArtifact(currentArtifact.id, currentArtifact.title)
                    }
                    disabled={isDownloading}
                    aria-label="Download as DOCX"
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
                    aria-label="Download as PDF"
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
