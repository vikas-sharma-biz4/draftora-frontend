"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import styles from "./NewClientModal.module.scss";

import type { Client, ClientDocument, NewClientFormData } from "@/types/client.types";
import { CLIENTS_STORAGE_KEY, INDUSTRIES, PIPELINE_STAGES } from "@/constants";

interface NewClientModalProps {
  onClose: () => void;
  onClientCreated: (client: Client) => void;
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

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);

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

  function handleUploadClick(): void {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = e.target.files;
    if (!files) return;
    
    setUploadedFiles((prev) => [...prev, ...Array.from(files)]);
    e.target.value = "";
  }

  function handleRemoveFile(index: number): void {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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

    setIsCreating(true);

    const clientId = `client-${Date.now()}`;
    const documents: ClientDocument[] = uploadedFiles.map((file, index) => {
      const ext = file.name.split(".").pop()?.toLowerCase() as "pdf" | "docx" | "xlsx" | "pptx";
      return {
        id: `${clientId}-doc-${index}`,
        name: file.name,
        size: formatFileSize(file.size),
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        status: "processing" as const,
        fileType: ext || "pdf",
        selected: false,
      };
    });

    const newClient: Client = {
      id: clientId,
      name: formData.clientName,
      industry: formData.industry,
      tier: "Mid-Market",
      onboardedDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      status: "active",
      documents,
      proposals: [],
      primaryContact: formData.primaryContactName && formData.primaryContactEmail
        ? {
            name: formData.primaryContactName,
            email: formData.primaryContactEmail,
          }
        : undefined,
      pipelineStage: formData.pipelineStage,
      notes: formData.notes,
    };

    try {
      const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
      const clients = raw ? (JSON.parse(raw) as Client[]) : [];
      clients.push(newClient);
      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));

      setTimeout(() => {
        const updatedClients = clients.map((c) =>
          c.id === clientId
            ? {
                ...c,
                documents: c.documents.map((doc) => ({ ...doc, status: "parsed" as const })),
              }
            : c
        );
        localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updatedClients));
      }, 3000);

      toast.success(`Client "${formData.clientName}" created successfully`);
      onClientCreated(newClient);
    } catch (error) {
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

            <div className={styles.uploadZone} onClick={handleUploadClick}>
              <Upload size={24} className={styles.uploadIcon} />
              <div className={styles.uploadText}>
                Click to upload or drag and drop
              </div>
              <div className={styles.uploadHint}>
                PDF, DOCX, XLSX, PPTX (max 10MB each)
              </div>
            </div>

            {uploadedFiles.length > 0 && (
              <div className={styles.fileList}>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className={styles.fileItem}>
                    <FileText size={16} className={styles.fileIcon} />
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      className={styles.removeFileBtn}
                      onClick={() => handleRemoveFile(index)}
                      aria-label="Remove file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
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
