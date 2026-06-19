"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, FileText, X, FileDown, Mail } from "lucide-react";

import { listArtifacts } from "@/services/artifact.service";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import { formatDate } from "@/utils/dateUtils";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { MESSAGES } from "@/constants/messages";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

import styles from "../ClientDetailPage.module.scss";

const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  enterprise_partnership: "Enterprise Partnership",
  advisory_phased_delivery: "Advisory Delivery",
  saas_product_launch: "SaaS Launch",
  podcast_proposal_script: "Podcast Script",
};

const TEMPLATE_FILTER_OPTIONS = Object.keys(EMAIL_TEMPLATE_LABELS);

interface EmailHistoryPanelProps {
  clientId: number;
  proposals: ProposalListItem[];
  onGenerateEmail: () => void;
}

function extractTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

function EmailViewerModal({
  artifact,
  proposalTitle,
  onClose,
}: {
  artifact: GeneratedArtifact;
  proposalTitle: string;
  onClose: () => void;
}): JSX.Element {
  const { isDownloading, downloadArtifact, isPdfDownloading, downloadArtifactPdf } =
    useArtifactDownload();

  const subject = (artifact.metadataJson?.subject as string | undefined) ?? artifact.title;
  const safeHtml = sanitizeHtml(artifact.content);

  return createPortal(
    <div
      className={styles.emailViewOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.emailViewModal}>
        <div className={styles.emailViewHeader}>
          <div className={styles.emailViewHeaderLeft}>
            <div className={styles.emailViewSubject}>{subject}</div>
            <div className={styles.emailViewMeta}>
              {proposalTitle && <span>Re: {proposalTitle}</span>}
              <span>{formatDate(artifact.createdAt)}</span>
            </div>
          </div>
          <div className={styles.emailViewHeaderActions}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void downloadArtifact(artifact.id, artifact.title)}
              disabled={isDownloading}
            >
              <FileDown size={14} />
              {isDownloading ? "…" : "DOCX"}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void downloadArtifactPdf(artifact.id, artifact.title)}
              disabled={isPdfDownloading}
            >
              <FileDown size={14} />
              {isPdfDownloading ? "…" : "PDF"}
            </button>
            <button className={styles.emailViewCloseBtn} onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className={styles.emailViewBody}>
          <div className={styles.emailViewHtml} dangerouslySetInnerHTML={{ __html: safeHtml }} />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function EmailHistoryPanel({
  clientId,
  proposals,
  onGenerateEmail,
}: EmailHistoryPanelProps): JSX.Element {
  const [emails, setEmails] = useState<GeneratedArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [viewingArtifact, setViewingArtifact] = useState<GeneratedArtifact | null>(null);

  const hasFetched = useRef(false);

  const proposalMap = new Map(proposals.map((p) => [p.id, p.title]));

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const results = await listArtifacts({ clientId, artifactType: "email" });
      setEmails(results);
    } catch (err) {
      logger.error("[EmailHistoryPanel] Failed to load emails:", err);
      toast.error(MESSAGES.EMAIL_HISTORY_LOAD_FAILED);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void load();
  }, [load]);

  const displayedEmails = selectedTemplate
    ? emails.filter((e) => (e.metadataJson?.template_id as string | undefined) === selectedTemplate)
    : emails;

  const viewingProposalTitle = viewingArtifact
    ? (proposalMap.get(viewingArtifact.proposalId) ?? "")
    : "";

  return (
    <>
      <div className={styles.emailHistory}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Email History</h2>
            <p className={styles.panelSubtitle}>All generated emails and outreach drafts</p>
          </div>
          <div className={styles.headerActions}>
            <select
              className={styles.typeFilter}
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              aria-label="Filter by template"
            >
              <option value="">All Templates</option>
              {TEMPLATE_FILTER_OPTIONS.map((id) => (
                <option key={id} value={id}>
                  {EMAIL_TEMPLATE_LABELS[id]}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={onGenerateEmail}>
              <Mail size={14} />
              Generate Email
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className={styles.emptyState}>
            <p>Loading emails…</p>
          </div>
        ) : displayedEmails.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={48} />
            <p>No emails yet</p>
            <p>Generate an email to get started</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.proposalTable}>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Template</th>
                  <th>Proposal</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th className={styles.actionsCol}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedEmails.map((email) => {
                  const subject =
                    (email.metadataJson?.subject as string | undefined) ?? email.title;
                  const templateId =
                    (email.metadataJson?.template_id as string | undefined) ?? email.templateId;
                  const templateLabel = EMAIL_TEMPLATE_LABELS[templateId] ?? templateId ?? "—";
                  const proposalTitle = proposalMap.get(email.proposalId) ?? "—";

                  return (
                    <tr
                      key={email.id}
                      className={styles.proposalRow}
                      onClick={() => setViewingArtifact(email)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div
                          className={styles.proposalName}
                          style={{
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={subject}
                        >
                          {subject}
                        </div>
                      </td>
                      <td>
                        <span className={styles.typeBadge}>{templateLabel}</span>
                      </td>
                      <td>
                        <div
                          className={styles.dateCell}
                          style={{
                            maxWidth: 140,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={proposalTitle}
                        >
                          {proposalTitle}
                        </div>
                      </td>
                      <td className={styles.dateCell}>{formatDate(email.createdAt)}</td>
                      <td className={styles.dateCell}>{extractTime(email.createdAt)}</td>
                      <td className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setViewingArtifact(email)}
                          title="View email"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingArtifact && (
        <EmailViewerModal
          artifact={viewingArtifact}
          proposalTitle={viewingProposalTitle}
          onClose={() => setViewingArtifact(null)}
        />
      )}
    </>
  );
}
