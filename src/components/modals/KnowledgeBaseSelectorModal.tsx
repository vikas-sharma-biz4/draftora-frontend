"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, FileText, Upload, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import styles from "./EditModal.module.scss";
import type { ClientDocument } from "@/interfaces/clientInterfaces";
import { parseFiles } from "@/services/api";
import type { ParsedFileResult } from "@/services/api";
import { useClientStore } from "@/redux/features/clientStore";
import { formatDate } from "@/utils/dateUtils";

interface KnowledgeBaseSelectorModalProps {
  availableDocuments: ClientDocument[];
  selectedDocumentIds: string[];
  onClose: () => void;
  onSave: (selectedIds: string[]) => void;
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
  const [uploadedFiles, setUploadedFiles] = useState<
    { file: File; id: string; status: "pending" | "parsing" | "parsed" | "error"; error?: string; parsedData?: ParsedFileResult; uploadedDocId?: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const uploadDocumentToStore = useClientStore(state => state.uploadDocument);
  const initializedRef = useRef<boolean>(false);

  // Sync selected state with selectedDocumentIds prop only on initial mount
  useEffect(() => {
    if (mounted && !initializedRef.current) {
      setSelected(new Set(selectedDocumentIds));
      initializedRef.current = true;
    }
  }, [mounted, selectedDocumentIds]);

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
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const filteredDocuments = availableDocuments;

  // Combine available documents with uploaded parsed documents
  const allDocuments = [
    ...availableDocuments,
    ...uploadedFiles
      .filter((f) => f.status === "parsed")
      .map((f) => ({
        id: f.uploadedDocId || f.id,
        name: f.file.name,
        size: f.file.size,
        date: formatDate(new Date().toISOString()),
        isNew: true,
      })),
  ];

  // Filter all documents by search query
  const filteredAllDocuments = allDocuments;

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
    const validFiles = Array.from(files).filter(isValidFile);
    if (validFiles.length === 0) return;

    const newFiles = validFiles.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: "pending" as const,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);
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
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "parsing" } : f))
    );

    try {
      const response = await parseFiles([file]);

      if (response.errors.length > 0) {
        const errMsg = response.errors[0].error;
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: errMsg } : f))
        );
        toast.error(`Failed to parse "${file.name}": ${errMsg}`);
        return;
      }

      const result = response.results[0];
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "parsed", parsedData: result } : f))
      );
      toast.success(`"${file.name}" parsed — ${result.word_count} words`);

      // Save to the selected client so it appears in Knowledge Base list
      await saveParsedDocumentToClient(file, fileId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backend connection failed";
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: message } : f))
      );
      toast.error(`Backend error parsing "${file.name}"`);
    }
  }

  async function saveParsedDocumentToClient(file: File, fileId: string, result: ParsedFileResult): Promise<void> {
    if (!clientId) return;

    try {
      const uploadResult = await uploadDocumentToStore(clientId, file);
      
      // Auto-select newly uploaded document
      setSelected((prev) => {
        const next = new Set(prev);
        next.add(String(uploadResult.id));
        return next;
      });
      
      // Keep the file in uploaded files list with parsed status so it appears in combined documents
      // Update the file ID to match the uploaded document ID
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: "parsed", parsedData: result, uploadedDocId: String(uploadResult.id) } : f
        )
      );
      
      // Refresh available documents to show newly uploaded document
      if (onRefreshDocuments) {
        onRefreshDocuments();
      }
      
      toast.success(`${file.name} uploaded and added to selected documents`);
    } catch (error) {
      console.error("Failed to upload document:", error);
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

  function handleSave(): void {
    const stillParsing = uploadedFiles.some((f) => f.status === "parsing");
    if (stillParsing) {
      toast.error("Please wait for all uploaded files to finish parsing");
      return;
    }

    // Add newly uploaded parsed files to selected documents
    // Use uploadedDocId if available (the actual API ID), otherwise fall back to temp ID
    const uploadedParsedIds = uploadedFiles
      .filter((f) => f.status === "parsed")
      .map((f) => f.uploadedDocId || f.id);

    const allSelected = Array.from(selected).concat(uploadedParsedIds);
    onSave(allSelected);
    toast.success(`${allSelected.length} document(s) selected`);
  }

  if (!mounted) return null;

  return createPortal(
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

        <div className={styles.modalBody}>
          {/* Upload Zone */}
          <label
            htmlFor="kb-file-upload"
            className={`${styles.uploadZone} ${isDragOver ? styles.dragOver : ""}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload size={24} className={styles.uploadIcon} aria-hidden="true" />
            <div className={styles.uploadText}>
              Click to upload or drag and drop
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
              className={styles.visuallyHidden}
            />
          </label>

          {/* Uploaded Files List - Only show parsing/error files */}
          {uploadedFiles.filter((f) => f.status !== "parsed").length > 0 && (
            <div className={styles.uploadedFilesList}>
              {uploadedFiles
                .filter((f) => f.status !== "parsed")
                .map(({ file, id, status, error, parsedData }) => (
                <div key={id} className={styles.uploadedFileItem}>
                  <div className={styles.fileIconWrapper}>
                    {status === "parsing" ? (
                      <Loader2 size={18} className={`${styles.fileIcon} ${styles.spinningIcon}`} />
                    ) : status === "error" ? (
                      <AlertCircle size={18} className={`${styles.fileIcon} ${styles.errorIcon}`} />
                    ) : status === "parsed" ? (
                      <CheckCircle size={18} className={`${styles.fileIcon} ${styles.successIcon}`} />
                    ) : (
                      <FileText size={18} className={styles.fileIcon} />
                    )}
                  </div>
                  <div className={styles.fileDetails}>
                    <div className={styles.fileName} title={file.name}>{file.name}</div>
                    <div className={styles.fileMeta}>
                      {formatFileSize(file.size)}
                      {status === "parsing" && (
                        <span className={styles.parsingStatus}> • Parsing on server...</span>
                      )}
                      {status === "parsed" && parsedData && (
                        <span className={styles.parsedStatus}> • {parsedData.word_count} words</span>
                      )}
                      {status === "error" && error && (
                        <span className={styles.errorStatus}> • {error}</span>
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

          <div className={styles.actionBar}>
            <button className={styles.toggleAllButton} onClick={toggleAll}>
              {selected.size === allDocuments.length ? "Deselect All" : "Select All"}
            </button>
            <span className={styles.counter}>{selected.size} document(s) selected</span>
          </div>

          {filteredAllDocuments.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText size={48} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                No documents available
              </p>
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
                        {doc.size ? `${(Number(doc.size) / 1024).toFixed(1)} KB` : ""} • {doc.date}
                        {"isNew" in doc && doc.isNew && <span className="badge badge-success">New</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
