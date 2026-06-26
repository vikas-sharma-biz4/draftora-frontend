"use client";

import { Upload, FileText, Eye, Trash2 } from "lucide-react";
import { formatDate } from "@/utils/dateUtils";
import type { ClientDocument } from "@/interfaces/clientInterfaces";
import type { useClientDocuments } from "@/hooks/useClientDocuments";
import DocumentViewerModal from "@/components/modals/DocumentViewerModal";
import panelStyles from "./ClientDocumentsPanel.module.scss";
import sharedStyles from "../ClientDetailPage.module.scss";

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

type DocumentsHook = ReturnType<typeof useClientDocuments>;

interface ClientDocumentsPanelProps {
  documents: ClientDocument[];
  docs: DocumentsHook;
}

export default function ClientDocumentsPanel({
  documents,
  docs,
}: ClientDocumentsPanelProps): JSX.Element {
  const {
    searchQuery,
    setSearchQuery,
    uploadingFiles,
    viewingDocId,
    viewingDocModal,
    closeDocViewer,
    filteredDocuments,
    fileInputRef,
    handleFileInputChange,
    handleViewDocument,
    handleDeleteDocument,
    handleDeleteAllDocuments,
  } = docs;

  return (
    <div className={sharedStyles.knowledgeBase}>
      <div className={sharedStyles.panelHeader}>
        <div>
          <h2 className={sharedStyles.panelTitle}>Knowledge Base</h2>
          <p className={sharedStyles.panelSubtitle}>Source documents for context generation</p>
        </div>
        <div className={sharedStyles.headerActions}>
          {filteredDocuments.length > 0 && (
            <button className={panelStyles.deleteAllBtn} onClick={handleDeleteAllDocuments}>
              Delete All
            </button>
          )}
          <button
            className={panelStyles.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFiles.size > 0}
            title="Upload Document"
          >
            <Upload size={20} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
          multiple
          onChange={handleFileInputChange}
          style={{ display: "none" }}
        />
      </div>

      {uploadingFiles.size > 0 && (
        <div className={panelStyles.uploadingIndicator}>
          <div className={panelStyles.uploadingText}>Uploading and parsing documents...</div>
        </div>
      )}

      {searchQuery !== "" && documents.length > 0 && (
        <div className={panelStyles.searchInput} style={{ margin: "0 0 12px" }}>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {filteredDocuments.length === 0 && uploadingFiles.size === 0 ? (
        <div className={sharedStyles.emptyState}>
          <FileText size={48} />
          <p>No documents yet</p>
          <p>Upload documents to build context</p>
        </div>
      ) : (
        <div className={panelStyles.documentList}>
          {filteredDocuments.map((doc) => {
            const iconClass =
              doc.fileType === "pdf"
                ? panelStyles.iconPdf
                : doc.fileType === "docx"
                  ? panelStyles.iconDocx
                  : doc.fileType === "xlsx"
                    ? panelStyles.iconXlsx
                    : panelStyles.iconDefault;

            return (
              <div
                key={doc.id}
                className={panelStyles.documentItem}
                style={{ position: "relative" }}
              >
                <div className={`${panelStyles.documentIcon} ${iconClass}`}>
                  {viewingDocId === doc.id ? (
                    <Eye size={20} style={{ opacity: 0.5 }} />
                  ) : (
                    <FileText size={20} />
                  )}
                </div>
                <div className={panelStyles.documentInfo}>
                  <div className={panelStyles.documentName}>{doc.name}</div>
                  <div className={panelStyles.documentMeta}>
                    <span>{formatFileSize(doc.sizeBytes)}</span>
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
                <div className={panelStyles.documentStatus}>
                  {doc.status === "parsed" ? (
                    <span className={panelStyles.statusParsed}>
                      <span className={panelStyles.statusDot}></span>
                      PARSED
                    </span>
                  ) : (
                    <span className={panelStyles.statusProcessing}>
                      <span className={panelStyles.statusDotProcessing}></span>
                      PROCESSING
                    </span>
                  )}
                </div>

                <button
                  className={sharedStyles.actionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleViewDocument(doc);
                  }}
                  title="View document"
                  style={{ width: 40, height: 40, padding: 0, flexShrink: 0 }}
                >
                  <Eye size={18} />
                </button>

                <button
                  className={sharedStyles.actionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDocument(doc.id, doc.name);
                  }}
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
            );
          })}
        </div>
      )}

      {viewingDocModal && (
        <DocumentViewerModal
          url={viewingDocModal.url}
          fileName={viewingDocModal.fileName}
          fileType={viewingDocModal.fileType}
          onClose={closeDocViewer}
        />
      )}
    </div>
  );
}
