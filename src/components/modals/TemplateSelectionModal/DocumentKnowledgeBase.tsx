"use client";

import React from "react";
import { CheckSquare, Square, ExternalLink } from "lucide-react";

import Button from "@/components/common/Button";
import styles from "./TemplateSelectionModal.module.scss";
import FileUploadZone from "./FileUploadZone";
import { formatFileSize } from "./utils";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";
import type { UploadedFile } from "./types";
import { formatDate } from "@/utils/dateUtils";

interface DocumentKnowledgeBaseProps {
  selectedClient: ClientWithDocuments;
  selectedClientId: number;
  selectedDocuments: Set<number>;
  uploadedFiles: UploadedFile[];
  viewingDocId: number | null;
  onToggleDocument: (docId: number) => void;
  onToggleAll: () => void;
  onViewDocument: (clientId: number, doc: { id: number; s3FileUrl?: string }) => Promise<void>;
  onProcessFiles: (files: FileList | null) => void;
  onRemoveFile: (fileId: string) => void;
  onRemoveAll: () => void;
}

export default function DocumentKnowledgeBase({
  selectedClient,
  selectedClientId,
  selectedDocuments,
  uploadedFiles,
  viewingDocId,
  onToggleDocument,
  onToggleAll,
  onViewDocument,
  onProcessFiles,
  onRemoveFile,
  onRemoveAll,
}: DocumentKnowledgeBaseProps): JSX.Element {
  const parsedDocs = (selectedClient.documents || []).filter((d) => d.status === "parsed");
  const allSelected = selectedDocuments.size === parsedDocs.length;

  return (
    <div className={styles.section}>
      {/* ── Document list ───────────────────────────────────────────── */}
      <div className={styles.sectionHeader}>
        <label className={styles.label}>Knowledge Base Selection</label>
        <Button variant="secondary" size="sm" onClick={onToggleAll} className={styles.toggleAllBtn}>
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
      </div>
      <p className={styles.hint}>Choose which documents to include as context for this proposal</p>

      <div className={styles.documentList}>
        {parsedDocs.length === 0 ? (
          <div className={styles.noDocuments}>No parsed documents available for this client.</div>
        ) : (
          parsedDocs.map((doc) => {
            const isSelected = selectedDocuments.has(doc.id);
            return (
              <div
                key={doc.id}
                className={`${styles.documentItem} ${isSelected ? styles.selected : ""}`}
                onClick={() => onToggleDocument(doc.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleDocument(doc.id);
                  }
                }}
              >
                <div className={styles.checkbox}>
                  {isSelected ? (
                    <CheckSquare size={18} className={styles.checkboxChecked} />
                  ) : (
                    <Square size={18} className={styles.checkboxUnchecked} />
                  )}
                </div>
                <div className={styles.documentInfo}>
                  <div className={styles.documentName} title={doc.name}>
                    {doc.name}
                  </div>
                  <div className={styles.documentMeta}>
                    {formatFileSize(doc.sizeBytes)} {formatDate(doc.createdAt)}
                  </div>
                </div>
                {doc.s3FileUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDocument(selectedClientId, doc);
                    }}
                    title="View file"
                    aria-label={`View ${doc.name}`}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 4px",
                      opacity: viewingDocId === doc.id ? 0.4 : 0.6,
                      flexShrink: 0,
                    }}
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {selectedDocuments.size > 0 && (
        <div className={styles.selectionSummary}>
          {selectedDocuments.size} document{selectedDocuments.size !== 1 ? "s" : ""} selected
        </div>
      )}

      {/* ── Additional upload ───────────────────────────────────────── */}
      <div className={styles.uploadSection}>
        <div className={styles.uploadHeader}>
          <label className={styles.label}>Upload Additional Documents</label>
        </div>
        <p className={styles.hint}>Upload new documents that will be parsed automatically</p>
        <FileUploadZone
          inputId="template-file-upload"
          uploadedFiles={uploadedFiles}
          onProcessFiles={onProcessFiles}
          onRemoveFile={onRemoveFile}
          onRemoveAll={onRemoveAll}
        />
      </div>
    </div>
  );
}
