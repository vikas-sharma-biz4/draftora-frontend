"use client";

import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { X, Search, ChevronDown, RefreshCw, Save, FileDown } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { INVOICE_TEMPLATES } from "@/constants/artifactTemplates";
import { generateArtifact, listArtifacts, updateArtifact } from "@/services/artifact.service";
import { listProposals } from "@/services/proposal.service";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import { formatDate } from "@/utils/dateUtils";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";

import styles from "./GenerateInvoiceModal.module.scss";

// Lazy-load RichEditor — it imports Tiptap which is heavy
const RichEditor = dynamic(() => import("@/components/common/RichEditor"), { ssr: false });

interface GenerateInvoiceModalProps {
  client: ClientWithDocuments;
  proposals: ProposalListItem[];
  onClose: () => void;
}

type ModalStep = 1 | 2;

const DEFAULT_TEMPLATE_ID = INVOICE_TEMPLATES[0].id;

export default function GenerateInvoiceModal({
  client,
  onClose,
}: Omit<GenerateInvoiceModalProps, "proposals">): JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<ModalStep>(1);

  // Step 1 state
  const [clientProposals, setClientProposals] = useState<ProposalListItem[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(true);
  const [proposalSearch, setProposalSearch] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);

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
      .catch((err) => logger.error("[GenerateInvoiceModal] Failed to load proposals:", err))
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

  const loadVersionHistory = useCallback(
    async (proposalId: number): Promise<void> => {
      try {
        const existing = await listArtifacts({
          clientId: client.id,
          proposalId,
          artifactType: "invoice",
        });
        setArtifacts(existing);
      } catch (err) {
        logger.error("[GenerateInvoiceModal] Failed to load version history:", err);
      }
    },
    [client.id]
  );

  function buildTitle(): string {
    const proposalTitle = selectedProposal?.title ?? "Proposal";
    return `Invoice — ${client.name} — ${proposalTitle}`;
  }

  async function handleGenerate(): Promise<void> {
    if (!selectedProposalId) return;
    setIsGenerating(true);
    setStep(2);
    try {
      const artifact = await generateArtifact({
        clientId: client.id,
        proposalId: selectedProposalId,
        templateId: DEFAULT_TEMPLATE_ID,
        artifactType: "invoice",
        title: buildTitle(),
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      setEditorContent(artifact.content);
    } catch (err) {
      logger.error("[GenerateInvoiceModal] Generation failed:", err);
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
        artifactType: "invoice",
        title: buildTitle(),
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      setEditorContent(artifact.content);
      toast.success(`Invoice v${artifact.version} generated`);
    } catch (err) {
      logger.error("[GenerateInvoiceModal] Regeneration failed:", err);
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
      logger.error("[GenerateInvoiceModal] Save failed:", err);
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
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Generate Invoice</span>
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

        {/* Step 1 */}
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

              {/* Template (auto-selected, display only) */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>2. Invoice Template</span>
                <div className={styles.templateCardSingle}>
                  <div className={styles.templateCardName}>{INVOICE_TEMPLATES[0].displayName}</div>
                  <div className={styles.templateCardDesc}>{INVOICE_TEMPLATES[0].description}</div>
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
                  Generate Invoice →
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2 — split editor / preview */}
        {step === 2 && (
          <>
            {isGenerating ? (
              <div className={styles.body}>
                <div className={styles.generatingState}>
                  <span className="spinner" style={{ width: 32, height: 32 }} />
                  <div className={styles.generatingText}>Generating your invoice…</div>
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
                    placeholder="Invoice content will appear here…"
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
