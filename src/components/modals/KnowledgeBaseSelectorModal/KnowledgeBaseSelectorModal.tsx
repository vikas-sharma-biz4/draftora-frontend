"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  FileText,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";

import styles from "../EditModal.module.scss";
import DocumentViewerModal from "@/components/modals/DocumentViewerModal";
import { getDocumentViewUrl } from "@/services/client.service";
import { parseFiles } from "@/services/upload.service";
import type { ParsedFileResult } from "@/services/upload.service";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { formatDate } from "@/utils/dateUtils";

interface KnowledgeBaseDocument {
  id: string;
  name: string;
  size: string;
  date: string;
  status: "parsed" | "processing";
  fileType: "pdf" | "docx" | "xlsx" | "pptx";
  selected?: boolean;
  isNew?: boolean;
  s3FileUrl?: string;
}

interface KnowledgeBaseSelectorModalProps {
  availableDocuments: KnowledgeBaseDocument[];
  selectedDocumentIds: string[];
  onClose: () => void;
  onSave: (selectedIds: string[], hasNewUploads: boolean) => void;
  clientId?: number;
  onRefreshDocuments?: () => void;
}

export default function KnowledgeBaseSelectorModal({
  availableDocuments,
  selectedDocumentIds,
  onClose,
  onSave,
  clientId,
  onRefreshDocuments,
}: KnowledgeBaseSelectorModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedDocumentIds));
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [viewingDocModal, setViewingDocModal] = useState<{
    url: string;
    fileName: string;
    fileType: string;
  } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    {
      file: File;
      id: string;
      status: "pending" | "parsing" | "parsed" | "error";
      error?: string;
      parsedData?: ParsedFileResult;
      uploadedDocId?: string;
    }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [hasNewUploads, setHasNewUploads] = useState<boolean>(false);
  const uploadDocumentToStore = useClientStore((state) => state.uploadDocument);
  const clients = useClientStore((state) => state.clients);
  const isStoreInitialized = useClientStore((state) => state.isInitialized);
  const initializedRef = useRef<boolean>(false);

  // True when the store has loaded but the client isn't found — uploads must be blocked
  const clientNotFound =
    isStoreInitialized && !!clientId && !clients.some((c) => c.id === clientId);

  // Sync selected state with selectedDocumentIds prop only on initial mount
  useEffect(() => {
    if (mounted && !initializedRef.current) {
      setSelected(new Set(selectedDocumentIds));
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select newly uploaded documents when they appear in availableDocuments
  useEffect(() => {
    if (mounted && availableDocuments.length > 0) {
      const uploadedDocIds = new Set(
        uploadedFiles.filter((f) => f.uploadedDocId).map((f) => f.uploadedDocId)
      );
      const newlyAvailableDocs = availableDocuments.filter((d) => uploadedDocIds.has(d.id));

      if (newlyAvailableDocs.length > 0) {
        setSelected((prev) => {
          const next = new Set(prev);
          let hasNew = false;
          newlyAvailableDocs.forEach((doc) => {
            if (!prev.has(doc.id)) {
              next.add(doc.id);
              hasNew = true;
            }
          });
          // Only update if something actually changed
          if (!hasNew) {
            return prev;
          }
          return next;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".xlsx", ".pptx"];
  const ACCEPTED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const filteredDocuments = availableDocuments;

  // Get client documents from store to ensure we have the latest data
  const currentClient = clients.find((c) => c.id === clientId);
  const storeDocuments = useMemo(
    () =>
      (currentClient?.documents || []).map((doc) => ({
        id: String(doc.id),
        name: doc.name,
        size: String(doc.sizeBytes > 0 ? doc.sizeBytes : 0),
        date: doc.createdAt ? formatDate(doc.createdAt) : "",
        status: (doc.status === "error" ? "processing" : doc.status) as "parsed" | "processing",
        fileType: (doc.fileType?.split("/").pop()?.split(".").pop() || "pdf") as
          | "pdf"
          | "docx"
          | "xlsx"
          | "pptx",
        s3FileUrl: doc.s3FileUrl,
      })),
    [currentClient?.documents]
  );

  // Debug logging
  logger.debug("[KnowledgeBaseSelectorModal] Document state:", {
    clientId,
    currentClientExists: !!currentClient,
    storeDocumentsCount: storeDocuments.length,
    uploadedFilesParsed: uploadedFiles.filter((f) => f.status === "parsed").length,
    uploadedFilesWithDocId: uploadedFiles
      .filter((f) => f.uploadedDocId)
      .map((f) => ({ name: f.file.name, uploadedDocId: f.uploadedDocId })),
  });

  // Combine store documents with uploaded parsed documents
  // Show all parsed uploaded files even if they're not yet in storeDocuments
  // This ensures newly uploaded documents remain visible during refresh
  const allDocuments = useMemo(
    () => [
      ...storeDocuments,
      ...uploadedFiles
        .filter(
          (f) =>
            f.status === "parsed" &&
            f.uploadedDocId &&
            !storeDocuments.some((d) => d.id === f.uploadedDocId)
        )
        .map((f) => ({
          id: f.uploadedDocId!,
          name: f.file.name,
          size: String(f.file.size),
          date: formatDate(new Date().toISOString()),
          status: "parsed" as const,
          fileType: "pdf" as const,
          isNew: true,
          s3FileUrl: undefined,
        })),
    ],
    [storeDocuments, uploadedFiles]
  );

  // Debug logging
  logger.debug("[KnowledgeBaseSelectorModal] Render state:", {
    availableDocuments: availableDocuments.length,
    uploadedFiles: uploadedFiles.length,
    uploadedParsed: uploadedFiles.filter((f) => f.status === "parsed").length,
    allDocuments: allDocuments.length,
  });

  // Auto-remove parsed files from the uploaded list once they appear in the document list below
  useEffect(() => {
    const parsedAndListed = uploadedFiles.filter(
      (f) =>
        f.status === "parsed" &&
        f.uploadedDocId &&
        allDocuments.some((d) => d.id === f.uploadedDocId)
    );
    if (parsedAndListed.length === 0) return;

    const timers = parsedAndListed.map((f) =>
      setTimeout(() => {
        setUploadedFiles((prev) => prev.filter((u) => u.id !== f.id));
      }, 1500)
    );

    return () => timers.forEach(clearTimeout);
  }, [uploadedFiles, allDocuments]);

  // Filter all documents by search query
  const filteredAllDocuments = allDocuments;

  // Filter selected IDs to only include documents that exist in allDocuments
  // This fixes the issue where counter shows selected count but checkboxes don't reflect it
  const allDocumentIds = useMemo(() => new Set(allDocuments.map((d) => d.id)), [allDocuments]);

  useEffect(() => {
    if (mounted) {
      setSelected((prev) => {
        // Check if any selected IDs are not in allDocumentIds
        const invalidIds = Array.from(prev).filter((id) => !allDocumentIds.has(id));
        if (invalidIds.length === 0) {
          return prev; // No changes needed
        }
        // Remove invalid IDs
        const filtered = new Set(prev);
        invalidIds.forEach((id) => filtered.delete(id));
        return filtered;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function isValidFile(file: File): boolean {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const typeOk = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);
    const sizeOk = file.size <= MAX_FILE_SIZE;
    if (!typeOk) {
      toast.error(`"${file.name}" is not a supported file type`);
      return false;
    }
    if (!sizeOk) {
      toast.error(`"${file.name}" exceeds 10 MB limit`);
      return false;
    }
    return true;
  }

  function processFileList(files: FileList | null): void {
    if (!files || files.length === 0) return;

    if (!clientId) {
      toast.error("No client selected. Please select a client first to upload documents.");
      return;
    }

    if (clientNotFound) {
      toast.error(
        "This client no longer exists. Please update the client details before uploading."
      );
      return;
    }

    const validFiles = Array.from(files).filter(isValidFile);
    if (validFiles.length === 0) return;

    const newFiles = validFiles.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: "pending" as const,
    }));

    logger.debug(
      "[KnowledgeBaseSelectorModal] Adding files to uploadedFiles:",
      newFiles.map((f) => ({ name: f.file.name, id: f.id }))
    );
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setHasNewUploads(true);
    newFiles.forEach((f) => startRealParsing(f.file, f.id));
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    processFileList(e.dataTransfer.files);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    processFileList(e.target.files);
    e.target.value = "";
  }

  async function startRealParsing(file: File, fileId: string): Promise<void> {
    logger.debug("[KnowledgeBaseSelectorModal] Starting parsing for file:", {
      fileId,
      fileName: file.name,
    });
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "parsing" } : f))
    );

    try {
      const response = await parseFiles([file]);
      logger.debug("[KnowledgeBaseSelectorModal] Parse response:", {
        fileId,
        fileName: file.name,
        hasErrors: response.errors.length > 0,
        hasResults: response.results.length > 0,
      });

      if (response.errors.length > 0) {
        const errMsg = response.errors[0].error;
        logger.error("[KnowledgeBaseSelectorModal] Parse error:", {
          fileId,
          fileName: file.name,
          error: errMsg,
        });
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: errMsg } : f))
        );
        toast.error(`Failed to parse "${file.name}": ${errMsg}`);
        return;
      }

      const result = response.results[0];
      logger.debug("[KnowledgeBaseSelectorModal] Parse success:", {
        fileId,
        fileName: file.name,
        wordCount: result.word_count,
      });
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "parsed", parsedData: result } : f))
      );
      // toast.success(`"${file.name}" parsed — ${result.word_count} words`);

      // Save to the selected client so it appears in Knowledge Base list
      await saveParsedDocumentToClient(file, fileId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backend connection failed";
      logger.error("[KnowledgeBaseSelectorModal] Backend error:", {
        fileId,
        fileName: file.name,
        error: message,
      });
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: message } : f))
      );
      toast.error(`Backend error parsing "${file.name}"`);
    }
  }

  async function saveParsedDocumentToClient(
    file: File,
    fileId: string,
    result: ParsedFileResult
  ): Promise<void> {
    if (!clientId) {
      logger.warn("[KnowledgeBaseSelectorModal] No clientId provided, skipping document save");
      toast.error("No client selected. Please select a client first to upload documents.");
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: "error", error: "No client selected" } : f
        )
      );
      return;
    }

    try {
      logger.debug("[KnowledgeBaseSelectorModal] Uploading document to client:", {
        clientId,
        fileName: file.name,
      });
      const uploadResult = await uploadDocumentToStore(clientId, file);

      if (!uploadResult) {
        throw new Error("Client not found — document could not be saved");
      }

      logger.debug("[KnowledgeBaseSelectorModal] Document uploaded to client:", {
        clientId,
        documentId: uploadResult.id,
        fileName: file.name,
      });

      // Auto-select newly uploaded document
      setSelected((prev) => {
        const next = new Set(prev);
        next.add(String(uploadResult.id));
        logger.debug("[KnowledgeBaseSelectorModal] Auto-selected document:", {
          documentId: uploadResult.id,
          totalSelected: next.size,
        });
        return next;
      });

      // Update the uploaded file with the real document ID
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, status: "parsed", parsedData: result, uploadedDocId: String(uploadResult.id) }
            : f
        )
      );

      // Auto-selection is handled by the useEffect that watches uploadedFiles

      // Don't call onRefreshDocuments - the document is already in the local store via addDocument
      // The parent's clientDocuments will automatically pick it up from the store

      // toast.success(`${file.name} uploaded`);
    } catch (error) {
      logger.error("Failed to upload document:", error);
      toast.error(`Failed to upload ${file.name}`);
    }
  }

  function handleRemoveFile(fileId: string): void {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function toggleDocument(docId: string): void {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  }

  function toggleAll(): void {
    if (selected.size === allDocuments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allDocuments.map((d) => d.id)));
    }
  }

  async function handleViewDocument(doc: KnowledgeBaseDocument): Promise<void> {
    if (!clientId || !doc.s3FileUrl) return;
    try {
      setViewingDocId(doc.id);
      const viewUrl = await getDocumentViewUrl(clientId, Number(doc.id));
      setViewingDocId(null);
      setViewingDocModal({ url: viewUrl, fileName: doc.name, fileType: doc.fileType });
    } catch {
      // silently ignore
    } finally {
      setViewingDocId(null);
    }
  }

  function handleSave(): void {
    const stillParsing = uploadedFiles.some((f) => f.status === "parsing");
    if (stillParsing) {
      toast.error("Please wait for all uploaded files to finish parsing");
      return;
    }

    // Only use the selected set - uploaded files are already auto-selected and included
    const allSelected = Array.from(selected);
    onSave(allSelected, hasNewUploads);
    onClose();
  }

  if (!mounted) return null;

  return (
    <>
      {createPortal(
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Select Knowledge Base Documents</h2>
                <p className={styles.modalSubtitle}>
                  Choose documents to include as context for this proposal
                </p>
              </div>
              <button className={styles.closeButton} onClick={onClose} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Upload section — always visible, outside the scrollable document list */}
            <div className={styles.uploadSection}>
              {clientNotFound && (
                <div className={styles.clientNotFoundBanner}>
                  <AlertCircle size={16} />
                  <span>
                    This client no longer exists in the system. Uploads are disabled. To add new
                    documents, update the client details first.
                  </span>
                </div>
              )}
              <label
                htmlFor="kb-file-upload"
                className={`${styles.uploadZone} ${isDragOver && !clientNotFound ? styles.dragOver : ""} ${clientNotFound ? styles.uploadZoneDisabled : ""}`}
                onDragOver={!clientNotFound ? handleDragOver : undefined}
                onDragEnter={!clientNotFound ? handleDragEnter : undefined}
                onDragLeave={!clientNotFound ? handleDragLeave : undefined}
                onDrop={!clientNotFound ? handleDrop : undefined}
              >
                <Upload size={20} className={styles.uploadIcon} aria-hidden="true" />
                <div className={styles.uploadText}>
                  {clientNotFound ? "Uploads unavailable" : "Click to upload or drag and drop"}
                </div>
                <div className={styles.uploadHint}>
                  PDF, DOCX, TXT, PNG, JPG, JPEG, XLSX, PPTX (max 10MB each)
                </div>
                <input
                  id="kb-file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
                  multiple
                  onChange={handleFileChange}
                  disabled={clientNotFound}
                  className={styles.visuallyHidden}
                />
              </label>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className={styles.uploadedFilesList}>
                  {uploadedFiles.map(({ file, id, status, error, parsedData, uploadedDocId }) => (
                    <div
                      key={id}
                      className={`${styles.uploadedFileItem}${status === "parsed" ? ` ${styles.uploadedFileItemParsed}` : ""}`}
                    >
                      <div
                        className={`${styles.fileIconWrapper}${
                          status === "parsed"
                            ? ` ${styles.fileIconWrapperSuccess}`
                            : status === "error"
                              ? ` ${styles.fileIconWrapperError}`
                              : status === "parsing"
                                ? ` ${styles.fileIconWrapperParsing}`
                                : ""
                        }`}
                      >
                        {status === "parsing" ? (
                          <Loader2
                            size={22}
                            className={`${styles.fileIcon} ${styles.spinningIcon}`}
                          />
                        ) : status === "error" ? (
                          <AlertCircle
                            size={22}
                            className={`${styles.fileIcon} ${styles.errorIcon}`}
                          />
                        ) : status === "parsed" ? (
                          <CheckCircle
                            size={22}
                            className={`${styles.fileIcon} ${styles.successIcon}`}
                          />
                        ) : (
                          <FileText size={22} className={styles.fileIcon} />
                        )}
                      </div>
                      <div className={styles.fileDetails}>
                        <div className={styles.fileName} title={file.name}>
                          {file.name}
                        </div>
                        <div className={styles.fileMeta}>
                          <span>{formatFileSize(file.size)}</span>
                          {status === "pending" && (
                            <span className={styles.parsingStatus}>· Waiting to upload...</span>
                          )}
                          {status === "parsing" && (
                            <span className={styles.parsingStatus}>· Parsing on server...</span>
                          )}
                          {status === "parsed" && parsedData && uploadedDocId && (
                            <span className={styles.parsedStatus}>· Parsing Complete</span>
                          )}
                          {status === "parsed" && !parsedData && (
                            <span className={styles.parsedStatus}>· Parsed successfully</span>
                          )}
                          {status === "error" && error && (
                            <span className={styles.errorStatus}>· {error}</span>
                          )}
                        </div>
                      </div>
                      <button
                        className={styles.removeFileBtn}
                        onClick={() => handleRemoveFile(id)}
                        title={status === "parsing" ? "Cancel parsing and remove" : "Remove file"}
                        aria-label="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable document list */}
            <div className={styles.modalBody}>
              <div className={styles.knowledgeBaseScrollContainer}>
                <div className={styles.actionBar}>
                  <button className={styles.toggleAllButton} onClick={toggleAll}>
                    {selected.size === allDocuments.length ? "Deselect All" : "Select All"}
                  </button>
                  <span className={styles.counter}>{selected.size} document(s) selected</span>
                </div>

                {filteredAllDocuments.length === 0 ? (
                  <div className={styles.emptyState}>
                    <FileText size={48} className={styles.emptyIcon} />
                    <p className={styles.emptyText}>No documents available</p>
                  </div>
                ) : (
                  <div className={styles.documentList}>
                    {filteredAllDocuments.map((doc) => {
                      const isSelected = selected.has(doc.id);
                      return (
                        <div
                          key={doc.id}
                          className={`${styles.documentItem} ${isSelected ? styles.selected : ""}`}
                          onClick={() => toggleDocument(doc.id)}
                          role="button"
                          tabIndex={0}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDocument(doc.id)}
                            className={styles.checkbox}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className={styles.documentInfo}>
                            <span className={styles.documentName}>{doc.name}</span>
                            <span className={styles.documentMeta}>
                              {doc.size ? `${(Number(doc.size) / 1024).toFixed(1)} KB` : ""}{" "}
                              {doc.date}
                              {"isNew" in doc && doc.isNew ? (
                                <span className="badge badge-success">New</span>
                              ) : null}
                            </span>
                          </div>
                          {doc.s3FileUrl && clientId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDocument(doc);
                              }}
                              title="View file"
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
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.saveButton} onClick={handleSave}>
                Save Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {viewingDocModal && (
        <DocumentViewerModal
          url={viewingDocModal.url}
          fileName={viewingDocModal.fileName}
          fileType={viewingDocModal.fileType}
          onClose={() => setViewingDocModal(null)}
        />
      )}
    </>
  );
}
