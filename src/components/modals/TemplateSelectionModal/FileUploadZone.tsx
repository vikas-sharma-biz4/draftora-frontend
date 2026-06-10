"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, Loader2, AlertCircle, CheckCircle } from "lucide-react";

import Button from "@/components/common/Button";
import styles from "./TemplateSelectionModal.module.scss";
import { formatFileSize } from "./utils";
import type { UploadedFile } from "./types";

interface FileUploadZoneProps {
  /** id attribute for the hidden <input> — must be unique per page */
  inputId: string;
  uploadedFiles: UploadedFile[];
  /** Called with the raw FileList from either the React onChange or the native backup listener */
  onProcessFiles: (files: FileList | null) => void;
  onRemoveFile: (fileId: string) => void;
  /** When provided, shows a "Remove All" button above the drop zone */
  onRemoveAll?: () => void;
}

export default function FileUploadZone({
  inputId,
  uploadedFiles,
  onProcessFiles,
  onRemoveFile,
  onRemoveAll,
}: FileUploadZoneProps): JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stable ref so the native backup listener always calls the latest onProcessFiles
  // even though the native listener effect has no deps (runs once per mount).
  const processFilesRef = useRef(onProcessFiles);
  processFilesRef.current = onProcessFiles;

  // Deduplication guard: prevents double-processing when React's synthetic onChange
  // and the native backup listener both fire for the same selection.
  const processedFingerprintsRef = useRef<Set<string>>(new Set());

  // Native backup listener — catches change events that React's synthetic system
  // misses on certain browsers and OS/file-picker combinations (Windows, Safari).
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    const onNativeChange = (evt: Event): void => {
      const target = evt.target as HTMLInputElement;
      const files = target.files;
      if (!files || files.length === 0) return;

      const fingerprint = Array.from(files)
        .map((f) => `${f.name}-${f.size}-${f.lastModified}`)
        .join("|");

      if (processedFingerprintsRef.current.has(fingerprint)) return;
      processedFingerprintsRef.current.add(fingerprint);
      setTimeout(() => processedFingerprintsRef.current.delete(fingerprint), 150);

      processFilesRef.current(files);
      target.value = "";
    };

    input.addEventListener("change", onNativeChange);
    return () => input.removeEventListener("change", onNativeChange);
  }, []);

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
    processFilesRef.current(e.dataTransfer.files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    processFilesRef.current(e.target.files);
    e.target.value = "";
  }

  return (
    <>
      {onRemoveAll && uploadedFiles.length > 0 && (
        <div className={styles.uploadHeader}>
          <Button variant="ghost" size="sm" onClick={onRemoveAll} className={styles.removeAllBtn}>
            Remove All
          </Button>
        </div>
      )}

      <label
        htmlFor={inputId}
        className={`${styles.uploadZone} ${isDragOver ? styles.dragOver : ""}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload size={24} className={styles.uploadIcon} aria-hidden="true" />
        <div className={styles.uploadText}>Click to upload or drag and drop</div>
        <div className={styles.uploadHint}>
          PDF, DOCX, TXT, PNG, JPG, JPEG, XLSX, PPTX (max 10MB each)
        </div>
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
          multiple
          onChange={handleChange}
          className={styles.visuallyHidden}
        />
      </label>

      {uploadedFiles.length > 0 && (
        <div className={styles.uploadedFilesList}>
          {uploadedFiles.map(({ file, id, status, error, parsedData }) => (
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
                <div className={styles.fileName} title={file.name}>
                  {file.name}
                </div>
                <div className={styles.fileMeta}>
                  {formatFileSize(file.size)}
                  {status === "parsing" && (
                    <span className={styles.parsingStatus}>Parsing on server...</span>
                  )}
                  {status === "parsed" && parsedData && (
                    <span className={styles.parsedStatus}>Parsing Complete</span>
                  )}
                  {status === "error" && error && (
                    <span className={styles.errorStatus}>{error}</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className={styles.removeFileBtn}
                onClick={() => onRemoveFile(id)}
                title={status === "parsing" ? "Cancel parsing and remove" : "Remove file"}
                aria-label={`Remove ${file.name}`}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
