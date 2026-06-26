"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Eye, FileText, Search, Trash2, X } from "lucide-react";

import { listArtifacts, deleteArtifact } from "@/services/artifact.service";
import { formatDate } from "@/utils/dateUtils";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";

import styles from "../ClientDetailPage.module.scss";

const DeleteConfirmModal = dynamic(
  () => import("@/components/modals/DeleteConfirmModal/DeleteConfirmModal"),
  { ssr: false }
);

interface GeneratedDocumentsPanelProps {
  clientId: number;
  refreshKey?: number;
}

export default function GeneratedDocumentsPanel({
  clientId,
  refreshKey = 0,
}: GeneratedDocumentsPanelProps): JSX.Element {
  const [documents, setDocuments] = useState<GeneratedArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [docToDelete, setDocToDelete] = useState<GeneratedArtifact | null>(null);
  const [viewerArtifact, setViewerArtifact] = useState<GeneratedArtifact | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const all = await listArtifacts({ clientId });
        if (!cancelled) {
          setDocuments(all.filter((a) => a.artifactType === "nda" || a.artifactType === "podcast"));
        }
      } catch (err) {
        logger.error("[GeneratedDocumentsPanel] Fetch failed:", err);
        if (!cancelled) toast.error("Failed to load generated documents");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, refreshKey]);

  async function confirmDelete(): Promise<void> {
    if (!docToDelete) return;
    try {
      await deleteArtifact(docToDelete.id);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      toast.success("Document deleted");
      setDocToDelete(null);
    } catch (err) {
      logger.error("[GeneratedDocumentsPanel] Delete failed:", err);
      toast.error("Failed to delete document");
    }
  }

  const displayed = documents.filter((d) =>
    searchQuery
      ? d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.artifactType.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <>
      <div className={styles.generatedDocs}>
        <div className={styles.panelTopRow}>
          <div>
            <h2 className={styles.panelTitle}>Generated NDA and Podcast</h2>
            <p className={styles.panelSubtitle}>
              NDAs and podcast scripts generated for this client
            </p>
          </div>
        </div>

        <div className={styles.panelSearchRow}>
          <div className={styles.searchInputFull}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by title or type…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className={styles.emptyState}>
            <p>Loading documents…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={48} />
            <p>No documents yet</p>
            <p>Generate an NDA or Podcast to get started</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.proposalTable}>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Type</th>
                  <th>Title</th>
                  <th style={{ width: 120 }}>Date</th>
                  <th
                    className={styles.actionsCol}
                    style={{ width: 90, minWidth: 90, textAlign: "center" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((doc) => (
                  <tr key={doc.id} className={styles.proposalRow}>
                    <td>
                      <span className={styles.docTypeBadge}>{doc.artifactType.toUpperCase()}</span>
                    </td>
                    <td>
                      <div className={styles.proposalName}>{doc.title}</div>
                    </td>
                    <td className={styles.dateCell}>{formatDate(doc.createdAt)}</td>
                    <td
                      className={styles.actionsCol}
                      style={{ width: 90, minWidth: 90, textAlign: "center" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles.invoiceActions}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setViewerArtifact(doc)}
                          title="View document"
                          style={{ width: 40, height: 40, padding: 0, flexShrink: 0 }}
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setDocToDelete(doc)}
                          title="Delete document"
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewerArtifact && (
        <div className={styles.emailViewOverlay} onClick={() => setViewerArtifact(null)}>
          <div className={styles.emailViewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.emailViewHeader}>
              <div className={styles.emailViewHeaderLeft}>
                <span className={styles.emailViewSubject}>{viewerArtifact.title}</span>
                <span className={styles.docTypeBadge} style={{ alignSelf: "flex-start" }}>
                  {viewerArtifact.artifactType.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => setViewerArtifact(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  color: "var(--color-text-muted)",
                  flexShrink: 0,
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.emailViewBody}>
              {viewerArtifact.artifactType === "podcast" ? (
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.7,
                  }}
                >
                  {viewerArtifact.content.replace(/<[^>]+>/g, "")}
                </pre>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewerArtifact.content) }} />
              )}
            </div>
          </div>
        </div>
      )}

      {docToDelete && (
        <DeleteConfirmModal
          title="Delete Document"
          itemName={docToDelete.title}
          warningMessage="This action cannot be undone. The document will be permanently removed."
          onClose={() => setDocToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
