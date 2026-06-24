"use client";

import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { useSteppedModal } from "@/hooks/useSteppedModal";
import { useQueryClient } from "@tanstack/react-query";
import { X, Search, ChevronDown, FileDown } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { INVOICE_TEMPLATES } from "@/constants/artifactTemplates";
import { generateArtifact, getMilestones, listArtifacts } from "@/services/artifact.service";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import { useClientProposalsQuery } from "@/hooks/useClientProposalsQuery";
import { clientInvoicesQueryKey } from "@/hooks/useClientInvoicesQuery";
import { formatDate } from "@/utils/dateUtils";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";
import type {
  GeneratedArtifact,
  InvoiceFormData,
  MilestoneCost,
} from "@/interfaces/artifactInterfaces";

import styles from "./GenerateInvoiceModal.module.scss";

const RichEditor = dynamic(() => import("@/components/common/RichEditor"), { ssr: false });

interface GenerateInvoiceModalProps {
  client: ClientWithDocuments;
  onClose: () => void;
  initialProposalId?: number;
}

const DEFAULT_TEMPLATE_ID = INVOICE_TEMPLATES[0].id;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultInvoiceNumber(): string {
  const d = new Date();
  return `INV-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatInvoiceDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  return isNaN(d.getTime())
    ? isoDate
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function GenerateInvoiceModal({
  client,
  onClose,
  initialProposalId,
}: GenerateInvoiceModalProps): JSX.Element | null {
  const queryClient = useQueryClient();

  const {
    mounted,
    step,
    setStep,
    showVersionDropdown,
    setShowVersionDropdown,
    isGenerating,
    setIsGenerating,
  } = useSteppedModal(onClose);

  // ── Invoice Details Form (Step 1) ────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState<string>(defaultInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState<string>(todayIso);
  const [clientName, setClientName] = useState<string>(client.name);
  const [companyName, setCompanyName] = useState<string>("");
  const [jobToBeDone, setJobToBeDone] = useState<string>("");

  // ── Proposal selector ────────────────────────────────────────────────────
  const {
    proposals: clientProposals,
    isLoading: isLoadingProposals,
    isError: isProposalsError,
  } = useClientProposalsQuery(client.id);
  const [proposalSearch, setProposalSearch] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(
    initialProposalId ?? null
  );

  // ── Milestones ───────────────────────────────────────────────────────────
  const [milestoneEntries, setMilestoneEntries] = useState<MilestoneCost[]>([]);
  const [isFetchingMilestones, setIsFetchingMilestones] = useState(false);

  // ── Step 2 state ─────────────────────────────────────────────────────────
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<GeneratedArtifact | null>(null);
  const [editorContent, setEditorContent] = useState("");

  const { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf } =
    useArtifactDownload();

  // When opened from a specific proposal, auto-load its milestones + version history
  useEffect(() => {
    if (initialProposalId) {
      void handleSelectProposal(initialProposalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProposals = clientProposals.filter((p) =>
    p.title.toLowerCase().includes(proposalSearch.toLowerCase())
  );

  const selectedProposal = clientProposals.find((p) => p.id === selectedProposalId) ?? null;

  const totalAmount = milestoneEntries.reduce((sum, e) => sum + (e.amount || 0), 0);

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

  async function handleSelectProposal(proposalId: number): Promise<void> {
    setSelectedProposalId(proposalId);
    setMilestoneEntries([]);
    setIsFetchingMilestones(true);
    void loadVersionHistory(proposalId);
    try {
      const ms = await getMilestones(proposalId);
      setMilestoneEntries(ms.map((m) => ({ milestone: m, amount: 0 })));
    } catch (err) {
      logger.error("[GenerateInvoiceModal] Failed to load milestones:", err);
      toast.error(MESSAGES.MILESTONES_LOAD_FAILED);
    } finally {
      setIsFetchingMilestones(false);
    }
  }

  function buildTitle(): string {
    const proposalTitle = selectedProposal?.title ?? "Proposal";
    return `Invoice — ${client.name} — ${proposalTitle}`;
  }

  function buildInvoiceMetadata(): InvoiceFormData {
    return {
      invoiceNumber,
      invoiceDate: formatInvoiceDate(invoiceDate),
      clientName,
      companyName,
      jobToBeDone,
      milestoneCosts: milestoneEntries,
    };
  }

  function canProceed(): boolean {
    return (
      invoiceNumber.trim().length > 0 &&
      invoiceDate.length > 0 &&
      jobToBeDone.trim().length > 0 &&
      selectedProposalId !== null &&
      totalAmount > 0
    );
  }

  function handleMilestoneNameChange(index: number, name: string): void {
    setMilestoneEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, milestone: name } : e))
    );
  }

  function handleMilestoneAmountChange(index: number, amount: number): void {
    setMilestoneEntries((prev) => prev.map((e, i) => (i === index ? { ...e, amount } : e)));
  }

  function handleRemoveMilestone(index: number): void {
    setMilestoneEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddMilestone(): void {
    setMilestoneEntries((prev) => [...prev, { milestone: "", amount: 0 }]);
  }

  async function callGenerateArtifact(isInitial: boolean): Promise<void> {
    if (!selectedProposalId) return;
    if (isInitial && !canProceed()) return;
    setIsGenerating(true);
    if (isInitial) setStep(2);
    try {
      const artifact = await generateArtifact({
        clientId: client.id,
        proposalId: selectedProposalId,
        templateId: DEFAULT_TEMPLATE_ID,
        artifactType: "invoice",
        title: buildTitle(),
        invoiceMetadata: buildInvoiceMetadata(),
      });
      setArtifacts((prev) => [artifact, ...prev]);
      setCurrentArtifact(artifact);
      setEditorContent(artifact.content);
      queryClient.setQueryData(
        clientInvoicesQueryKey(client.id),
        (old: GeneratedArtifact[] | undefined) => [artifact, ...(old ?? [])]
      );
      void queryClient.invalidateQueries({ queryKey: clientInvoicesQueryKey(client.id) });
      if (!isInitial) toast.success(`Invoice v${artifact.version} generated`);
    } catch (err) {
      logger.error("[GenerateInvoiceModal] Generation failed:", err);
      toast.error(MESSAGES.ARTIFACT_GENERATE_FAILED);
      if (isInitial) setStep(1);
    } finally {
      setIsGenerating(false);
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
        aria-labelledby="invoice-modal-title"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title} id="invoice-modal-title">
              Generate Invoice
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

        {/* ── Step 1: Invoice Details Form ── */}
        {step === 1 && (
          <>
            <div className={styles.body}>
              {/* Invoice details */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Invoice Details</span>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label className={styles.formFieldLabel}>Invoice Number *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="INV-2026-001"
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formFieldLabel}>Invoice Date *</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formFieldLabel}>Client Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formFieldLabel}>Company Name</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className={styles.formField}>
                  <label className={styles.formFieldLabel}>Job To Be Done *</label>
                  <textarea
                    className={styles.formTextarea}
                    value={jobToBeDone}
                    onChange={(e) => setJobToBeDone(e.target.value)}
                    placeholder="Describe the work to be done…"
                    rows={3}
                  />
                </div>
              </div>

              {/* Proposal selector */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Select Proposal *</span>
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
                        onClick={() => void handleSelectProposal(p.id)}
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

              {/* Milestone costs (shown after proposal is selected) */}
              {selectedProposalId && (
                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Milestone Costs</span>
                  {isFetchingMilestones ? (
                    <div className={styles.emptyState}>Loading milestones…</div>
                  ) : (
                    <div className={styles.milestonesTable}>
                      {milestoneEntries.map((entry, index) => (
                        <div key={index} className={styles.milestoneRow}>
                          <input
                            type="text"
                            className={styles.milestoneNameInput}
                            value={entry.milestone}
                            onChange={(e) => handleMilestoneNameChange(index, e.target.value)}
                            placeholder="Milestone name"
                          />
                          <div className={styles.milestoneAmountWrap}>
                            <span className={styles.milestoneCurrency}>$</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              className={styles.milestoneAmountInput}
                              value={entry.amount || ""}
                              onChange={(e) =>
                                handleMilestoneAmountChange(index, parseFloat(e.target.value) || 0)
                              }
                              placeholder="0"
                            />
                            <button
                              type="button"
                              className={styles.milestoneRemoveBtn}
                              onClick={() => handleRemoveMilestone(index)}
                              aria-label="Remove milestone"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className={styles.milestoneAddRow}>
                        <button
                          type="button"
                          className={styles.milestoneAddBtn}
                          onClick={handleAddMilestone}
                        >
                          + Add Milestone
                        </button>
                      </div>
                      {milestoneEntries.length > 0 && (
                        <div className={styles.milestoneTotalRow}>
                          <span className={styles.milestoneTotalLabel}>Total Amount</span>
                          <span className={styles.milestoneTotalValue}>
                            ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                  disabled={!canProceed()}
                  title={
                    !canProceed()
                      ? "Fill in all required fields, select a proposal, and add at least one milestone cost"
                      : undefined
                  }
                >
                  Generate Invoice →
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: Generated Invoice Preview ── */}
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
                <div className={styles.footerLeft} />
                <div className={styles.footerRight}>
                  <button
                    className="btn btn-secondary btn-sm"
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
