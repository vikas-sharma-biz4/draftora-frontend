"use client";

import { Upload, FileText, Eye, X, CloudUpload } from "lucide-react";
import { formatDate } from "@/utils/dateUtils";
import type { ClientDocument } from "@/interfaces/clientInterfaces";
import type { useClientDocuments } from "@/hooks/useClientDocuments";
import DocumentViewerModal from "@/components/modals/DocumentViewerModal";
import styles from "../ClientDetailPage.module.scss";

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
    restoringDocId,
    filteredDocuments,
    fileInputRef,
    restoreFileInputRef,
    handleFileInputChange,
    handleRestoreFileInputChange,
    handleViewDocument,
    handleDeleteDocument,
    handleRestoreToS3Click,
    handleDeleteAllDocuments,
  } = docs;

  return (
    <div className={styles.knowledgeBase}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Knowledge Base</h2>
          <p className={styles.panelSubtitle}>Source documents for context generation</p>
        </div>
        <div className={styles.headerActions}>
          {filteredDocuments.length > 0 && (
            <button
              className={styles.deleteAllBtn}
              onClick={handleDeleteAllDocuments}
              title="Delete all documents"
            >
              <X size={18} />
            </button>
          )}
          <button
            className={styles.uploadBtn}
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
        <input
          ref={restoreFileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
          onChange={handleRestoreFileInputChange}
          style={{ display: "none" }}
        />
      </div>

      {uploadingFiles.size > 0 && (
        <div className={styles.uploadingIndicator}>
          <div className={styles.uploadingText}>Uploading and parsing documents...</div>
        </div>
      )}

      {searchQuery !== "" && documents.length > 0 && (
        <div className={styles.searchInput} style={{ margin: "0 0 12px" }}>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {filteredDocuments.length === 0 && uploadingFiles.size === 0 ? (
        <div className={styles.emptyState}>
          <FileText size={48} />
          <p>No documents yet</p>
          <p>Upload documents to build context</p>
        </div>
      ) : (
        <div className={styles.documentList}>
          {filteredDocuments.map((doc) => {
            const iconClass =
              doc.fileType === "pdf"
                ? styles.iconPdf
                : doc.fileType === "docx"
                  ? styles.iconDocx
                  : doc.fileType === "xlsx"
                    ? styles.iconXlsx
                    : styles.iconDefault;

            return (
              <div
                key={doc.id}
                className={styles.documentItem}
                onClick={() => handleViewDocument(doc)}
                style={{ cursor: "pointer" }}
                title="Click to view file"
              >
                <div className={`${styles.documentIcon} ${iconClass}`}>
                  {viewingDocId === doc.id ? (
                    <Eye size={20} style={{ opacity: 0.5 }} />
                  ) : (
                    <FileText size={20} />
                  )}
                </div>
                <div className={styles.documentInfo}>
                  <div className={styles.documentName}>{doc.name}</div>
                  <div className={styles.documentMeta}>
                    <span>{Math.round(doc.sizeBytes / 1024)} KB</span>
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
                <div className={styles.documentStatus}>
                  {doc.status === "parsed" ? (
                    <span className={styles.statusParsed}>
                      <span className={styles.statusDot}></span>
                      PARSED
                    </span>
                  ) : (
                    <span className={styles.statusProcessing}>
                      <span className={styles.statusDotProcessing}></span>
                      PROCESSING
                    </span>
                  )}
                </div>
                {!doc.s3FileUrl && (
                  <button
                    className={styles.restoreS3Btn}
                    onClick={(e) => handleRestoreToS3Click(doc.id, e)}
                    disabled={restoringDocId === doc.id}
                    title="Upload original file to enable viewing"
                    aria-label="Upload to S3"
                  >
                    <CloudUpload size={14} />
                  </button>
                )}
                <button
                  className={styles.deleteDocBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDocument(doc.id, doc.name);
                  }}
                  title="Delete document"
                >
                  <X size={16} />
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
