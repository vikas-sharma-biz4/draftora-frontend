"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Upload, FileText, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import styles from "./NewClientModal.module.scss";

import { createClient, uploadDocument, type Client as ApiClient } from "@/api/clientApi";
import type { NewClientFormData } from "@/types/client.types";
import { INDUSTRIES, PIPELINE_STAGES } from "@/constants";
import { parseFiles } from "@/services/api";
import type { ParsedFileResult } from "@/services/api";

interface NewClientModalProps {
  onClose: () => void;
  onClientCreated: () => void;
}

export default function NewClientModal({ onClose, onClientCreated }: NewClientModalProps): JSX.Element | null {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mounted, setMounted] = useState<boolean>(false);
  const [formData, setFormData] = useState<NewClientFormData>({
    clientName: "",
    industry: "",
    pipelineStage: "Discovery",
    primaryContactName: "",
    primaryContactEmail: "",
    notes: "",
  });

  const [uploadedFiles, setUploadedFiles] = useState<
    { file: File; id: string; status: "pending" | "parsing" | "parsed" | "error"; error?: string; parsedData?: ParsedFileResult }[]
  >([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const processedFilesRef = useRef<Set<string>>(new Set());

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

  function handleInputChange(field: keyof NewClientFormData, value: string): void {
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

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

    // Start real backend parsing immediately for each file
    newFiles.forEach((f) => startRealParsing(f.file, f.id));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    processFileList(e.target.files);
    e.target.value = "";
  }

  // Native backup listener — catches events that React's synthetic system misses
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    const onNativeChange = (evt: Event) => {
      const target = evt.target as HTMLInputElement;
      const files = target.files;
      if (!files || files.length === 0) return;

      const fingerprint = Array.from(files)
        .map((f) => `${f.name}-${f.size}-${f.lastModified}`)
        .join("|");
      if (processedFilesRef.current.has(fingerprint)) return;
      processedFilesRef.current.add(fingerprint);
      setTimeout(() => processedFilesRef.current.delete(fingerprint), 150);

      processFileList(files);
      target.value = "";
    };

    input.addEventListener("change", onNativeChange);
    return () => input.removeEventListener("change", onNativeChange);
  }, []);

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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backend connection failed";
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: message } : f))
      );
      toast.error(`Backend error parsing "${file.name}"`);
    }
  }

  function handleRemoveFile(fileId: string): void {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  async function handleCreate(): Promise<void> {
    if (!formData.clientName.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (!formData.industry) {
      toast.error("Please select an industry");
      return;
    }

    // Prevent creating if any files are still parsing
    const stillParsing = uploadedFiles.some((f) => f.status === "parsing");
    if (stillParsing) {
      toast.error("Please wait for all files to finish parsing");
      return;
    }

    setIsCreating(true);

    try {
      // Create client via API
      const newClient = await createClient({
        name: formData.clientName,
        industry: formData.industry,
        notes: formData.notes || undefined,
      });

      // Upload documents if any
      if (uploadedFiles.length > 0) {
        for (const uploaded of uploadedFiles) {
          try {
            await uploadDocument(newClient.id, uploaded.file);
          } catch (error) {
            console.error(`Failed to upload ${uploaded.file.name}:`, error);
            toast.error(`Failed to upload ${uploaded.file.name}`);
          }
        }
      }

      toast.success(`Client "${formData.clientName}" created successfully`);
      onClientCreated();
    } catch (error) {
      console.error("Failed to create client:", error);
      toast.error("Failed to create client");
      setIsCreating(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Add New Client</h2>
            <p className={styles.modalSubtitle}>Enter details to provision a new client workspace.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.section}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Client Name</label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. Acme Corporation"
                value={formData.clientName}
                onChange={(e) => handleInputChange("clientName", e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Industry</label>
              <select
                className={styles.select}
                value={formData.industry}
                onChange={(e) => handleInputChange("industry", e.target.value)}
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Initial Context & Notes
              <span className={styles.optional}>Optional</span>
            </h3>

            <div className={styles.formGroup}>
              <textarea
                className={styles.textarea}
                placeholder="Add any background context, specific requirements, or initial observations..."
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Upload Documents</h3>

            <label
              htmlFor="new-client-file-upload"
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
                id="new-client-file-upload"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
                multiple
                onChange={handleFileChange}
                className={styles.visuallyHidden}
              />
            </label>

            {uploadedFiles.length > 0 && (
              <div className={styles.fileList}>
                {uploadedFiles.map(({ file, id, status, error, parsedData }) => (
                  <div key={id} className={styles.fileItem}>
                    {status === "parsing" ? (
                      <Loader2 size={16} className={`${styles.fileIcon} ${styles.spinningIcon}`} />
                    ) : status === "error" ? (
                      <AlertCircle size={16} className={`${styles.fileIcon} ${styles.errorIcon}`} />
                    ) : status === "parsed" ? (
                      <CheckCircle size={16} className={`${styles.fileIcon} ${styles.successIcon}`} />
                    ) : (
                      <FileText size={16} className={styles.fileIcon} />
                    )}
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileMeta}>
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
                      </span>
                    </div>
                    <button
                      className={styles.removeFileBtn}
                      onClick={() => handleRemoveFile(id)}
                      disabled={status === "parsing"}
                      aria-label="Remove file"
                      title={status === "parsing" ? "Wait for parsing to complete" : "Remove file"}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isCreating}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={isCreating || !formData.clientName.trim() || !formData.industry}
          >
            {isCreating ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                Creating...
              </>
            ) : (
              "Create Client"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
