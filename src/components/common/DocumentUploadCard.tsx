"use client";

import React, { useState, useRef } from "react";
import { Upload, X, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import styles from "./DocumentUploadCard.module.scss";

interface UploadingFile {
  id: string;
  name: string;
  size: string;
  status: "uploading" | "parsing" | "completed" | "error";
  progress: number;
}

interface DocumentUploadCardProps {
  onFilesUploaded?: (files: File[]) => void;
}

export default function DocumentUploadCard({ onFilesUploaded }: DocumentUploadCardProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function handleUploadClick(): void {
    fileInputRef.current?.click();
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(): void {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files) {
      processFiles(Array.from(files));
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = e.target.files;
    if (files) {
      processFiles(Array.from(files));
    }
    e.target.value = "";
  }

  function processFiles(files: File[]): void {
    const validFiles = files.filter((file) => {
      const validTypes = [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".xlsx", ".pptx"];
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!validTypes.includes(ext)) {
        toast.error(`${file.name} is not a supported format`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Add files to uploading state and start parsing
    const newFiles: UploadingFile[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: formatFileSize(file.size),
      status: "uploading",
      progress: 0,
    }));

    setUploadingFiles((prev) => [...prev, ...newFiles]);

    // Simulate upload and parsing
    newFiles.forEach((uploadFile, index) => {
      const file = validFiles[index];
      
      // Simulate upload (0-50%)
      let progress = 0;
      const uploadInterval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 50) {
          clearInterval(uploadInterval);
          progress = 50;
          
          // Update to parsing status
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? { ...f, status: "parsing", progress: 50 }
                : f
            )
          );

          // Simulate parsing (50-100%)
          let parseProgress = 50;
          const parseInterval = setInterval(() => {
            parseProgress += Math.random() * 25;
            if (parseProgress >= 100) {
              clearInterval(parseInterval);
              parseProgress = 100;
              
              // Mark as completed
              setUploadingFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadFile.id
                    ? { ...f, status: "completed", progress: 100 }
                    : f
                )
              );
              
              toast.success(`${file.name} parsed successfully`);
            } else {
              setUploadingFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadFile.id
                    ? { ...f, progress: parseProgress }
                    : f
                )
              );
            }
          }, 300);
        } else {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? { ...f, progress }
                : f
            )
          );
        }
      }, 200);
    });

    onFilesUploaded?.(validFiles);
  }

  function handleCancelParsing(fileId: string): void {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
    toast.info("Parsing cancelled");
  }

  function handleRemoveCompleted(fileId: string): void {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  return (
    <div className={styles.uploadCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Upload Additional Documents</h3>
        <p className={styles.cardSubtitle}>
          Add more context documents. They will parse automatically.
        </p>
      </div>

      {uploadingFiles.length === 0 ? (
        <div
          className={`${styles.uploadZone} ${isDragging ? styles.dragging : ""}`}
          onClick={handleUploadClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload size={32} className={styles.uploadIcon} />
          <div className={styles.uploadText}>
            Click to upload or drag and drop
          </div>
          <div className={styles.uploadHint}>
            PDF, DOCX, XLSX, PPTX (max 10MB each)
          </div>
        </div>
      ) : (
        <div className={styles.filesList}>
          {uploadingFiles.map((file) => (
            <div key={file.id} className={styles.fileItem}>
              <div className={styles.fileIcon}>
                {file.status === "completed" && (
                  <CheckCircle2 size={18} className={styles.iconSuccess} />
                )}
                {file.status === "error" && (
                  <AlertCircle size={18} className={styles.iconError} />
                )}
                {(file.status === "uploading" || file.status === "parsing") && (
                  <Loader2 size={18} className={styles.iconLoading} />
                )}
                {!["completed", "error", "uploading", "parsing"].includes(file.status) && (
                  <FileText size={18} className={styles.iconDefault} />
                )}
              </div>

              <div className={styles.fileInfo}>
                <div className={styles.fileName}>{file.name}</div>
                <div className={styles.fileSize}>{file.size}</div>
              </div>

              <div className={styles.fileStatus}>
                {file.status === "uploading" && (
                  <span className={styles.statusLabel}>Uploading...</span>
                )}
                {file.status === "parsing" && (
                  <span className={styles.statusLabel}>Parsing...</span>
                )}
                {file.status === "completed" && (
                  <span className={styles.statusLabel}>Done</span>
                )}
              </div>

              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${file.progress}%` }}
                />
              </div>

              {(file.status === "uploading" || file.status === "parsing") && (
                <button
                  className={styles.cancelBtn}
                  onClick={() => handleCancelParsing(file.id)}
                  aria-label="Cancel parsing"
                >
                  <X size={16} />
                </button>
              )}

              {file.status === "completed" && (
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemoveCompleted(file.id)}
                  aria-label="Remove file"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {uploadingFiles.length > 0 && (
        <button
          className={styles.addMoreBtn}
          onClick={handleUploadClick}
        >
          <Upload size={14} />
          Add More Documents
        </button>
      )}
    </div>
  );
}
