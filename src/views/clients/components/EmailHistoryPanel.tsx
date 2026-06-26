"use client";

import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, FileText, X, FileDown, Mail, Search, Trash2 } from "lucide-react";

import {
  listArtifacts,
  regenerateArtifactSelection,
  deleteArtifact,
} from "@/services/artifact.service";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";
import { useClientProposalsQuery } from "@/hooks/useClientProposalsQuery";
import { formatDate } from "@/utils/dateUtils";
import { fixProposalLinks } from "@/utils/emailUtils";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { MESSAGES } from "@/constants/messages";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

import styles from "../ClientDetailPage.module.scss";

// Lazy-load RichEditor — it imports Tiptap which is heavy
const RichEditor = dynamic(() => import("@/components/common/RichEditor"), { ssr: false });

const DeleteConfirmModal = dynamic(
  () => import("@/components/modals/DeleteConfirmModal/DeleteConfirmModal"),
  { ssr: false }
);

interface EmailHistoryPanelProps {
  clientId: number;
  proposals: ProposalListItem[];
  onGenerateEmail: () => void;
  refreshKey?: number;
}

function extractTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

function stripSubjectLine(html: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const paragraphs = doc.querySelectorAll("p");
  for (const p of paragraphs) {
    if (p.textContent?.trim().startsWith("Subject:")) {
      if (p.nextElementSibling?.tagName === "HR") {
        p.nextElementSibling.remove();
      }
      p.remove();
      break;
    }
  }
  return doc.body.innerHTML;
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
  const [editorContent, setEditorContent] = useState<string>(() => {
    const sanitized =
      artifact.proposalId !== null
        ? fixProposalLinks(sanitizeHtml(artifact.content), artifact.proposalId)
        : sanitizeHtml(artifact.content);
    return stripSubjectLine(sanitized);
  });

  const subject = (artifact.metadataJson?.subject as string | undefined) ?? artifact.title;

  async function handleRegenerateSelection(params: {
    selectedText: string;
    selectionRange: { from: number; to: number };
    instructions?: string;
    selectionContext?: string;
  }) {
    try {
      return await regenerateArtifactSelection(artifact.id, {
        selectedText: params.selectedText,
        selectionContext: params.selectionContext,
        instructions: params.instructions,
      });
    } catch (err) {
      logger.error("[EmailViewerModal] AI regeneration failed:", err);
      toast.error(MESSAGES.ARTIFACT_REGEN_FAILED);
      return null;
    }
  }

  return createPortal(
    <div
      className={styles.emailViewOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.emailViewModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-viewer-title"
      >
        <div className={styles.emailViewHeader}>
          <div className={styles.emailViewHeaderLeft}>
            <div id="email-viewer-title" className={styles.emailViewSubject}>
              {subject}
            </div>
            <div className={styles.emailViewMeta}>
              {proposalTitle && <span>Re: {proposalTitle}</span>}
              <span>{formatDate(artifact.createdAt)}</span>
            </div>
          </div>
          <div className={styles.emailViewHeaderActions}>
            <button
              className="btn btn-secondary btn-sm"
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
          <RichEditor
            content={editorContent}
            onChange={setEditorContent}
            onRegenerateSelection={handleRegenerateSelection}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function EmailHistoryPanel({
  clientId,
  proposals: _proposalsProp,
  onGenerateEmail,
  refreshKey = 0,
}: EmailHistoryPanelProps): JSX.Element {
  const [emails, setEmails] = useState<GeneratedArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingArtifact, setViewingArtifact] = useState<GeneratedArtifact | null>(null);
  const [emailToDelete, setEmailToDelete] = useState<GeneratedArtifact | null>(null);

  const hasFetched = useRef(false);

  // Use TanStack Query to fetch proposals so the map is always populated,
  // even when the parent store hasn't loaded all proposals yet.
  const { proposals: fetchedProposals } = useClientProposalsQuery(clientId);
  const proposalMap = new Map(fetchedProposals.map((p) => [p.id, p.title]));

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

  useEffect(() => {
    if (!refreshKey) return;
    void load();
  }, [load, refreshKey]);

  async function confirmDeleteEmail(): Promise<void> {
    if (!emailToDelete) return;
    try {
      await deleteArtifact(emailToDelete.id);
      setEmails((prev) => prev.filter((e) => e.id !== emailToDelete.id));
      toast.success("Email deleted");
      setEmailToDelete(null);
    } catch (err) {
      logger.error("[EmailHistoryPanel] Delete failed:", err);
      toast.error("Failed to delete email");
    }
  }

  const displayedEmails = emails.filter((e) => {
    if (searchQuery) {
      const subject = ((e.metadataJson?.subject as string | undefined) ?? e.title).toLowerCase();
      const proposalTitle = (
        e.proposalId != null ? (proposalMap.get(e.proposalId) ?? "") : ""
      ).toLowerCase();
      if (
        !subject.includes(searchQuery.toLowerCase()) &&
        !proposalTitle.includes(searchQuery.toLowerCase())
      )
        return false;
    }
    return true;
  });

  const viewingProposalTitle =
    viewingArtifact?.proposalId != null ? (proposalMap.get(viewingArtifact.proposalId) ?? "") : "";

  return (
    <>
      <div className={styles.emailHistory}>
        <div className={styles.panelTopRow}>
          <div>
            <h2 className={styles.panelTitle}>Email History</h2>
            <p className={styles.panelSubtitle}>All generated emails and outreach drafts</p>
          </div>
          <div className={styles.headerActions}>
            <button className="btn btn-secondary btn-sm" onClick={onGenerateEmail}>
              <Mail size={14} />
              Generate Email
            </button>
          </div>
        </div>

        <div className={styles.panelSearchRow}>
          <div className={styles.searchInputFull}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by subject or proposal…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
                  const proposalTitle =
                    email.proposalId != null ? (proposalMap.get(email.proposalId) ?? "—") : "—";

                  return (
                    <tr key={email.id} className={styles.proposalRow}>
                      <td>
                        <div
                          className={styles.proposalName}
                          style={{ wordBreak: "break-word" }}
                          title={subject}
                        >
                          {subject}
                        </div>
                      </td>
                      <td>
                        <div
                          className={styles.dateCell}
                          style={{ wordBreak: "break-word" }}
                          title={proposalTitle}
                        >
                          {proposalTitle}
                        </div>
                      </td>
                      <td className={styles.dateCell}>{formatDate(email.createdAt)}</td>
                      <td className={styles.dateCell}>{extractTime(email.createdAt)}</td>
                      <td className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.invoiceActions}>
                          <button
                            className={styles.actionBtn}
                            onClick={() => setViewingArtifact(email)}
                            title="View email"
                            style={{ width: 40, height: 40, padding: 0, flexShrink: 0 }}
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            className={styles.actionBtn}
                            onClick={() => setEmailToDelete(email)}
                            title="Delete email"
                            style={{
                              width: 40,
                              height: 40,
                              padding: 0,
                              flexShrink: 0,
                              color: "var(--color-danger, #e53e3e)",
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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

      {emailToDelete && (
        <DeleteConfirmModal
          title="Delete Email"
          itemName={
            (emailToDelete.metadataJson?.subject as string | undefined) ?? emailToDelete.title
          }
          warningMessage="This action cannot be undone. The email will be permanently removed."
          onClose={() => setEmailToDelete(null)}
          onConfirm={confirmDeleteEmail}
        />
      )}
    </>
  );
}
