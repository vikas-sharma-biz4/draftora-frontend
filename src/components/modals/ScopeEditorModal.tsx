"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";

import styles from "./EditModal.module.scss";

interface ScopeEditorModalProps {
  proposalTitle: string;
  clientName: string;
  description: string;
  onClose: () => void;
  onSave: (data: { title: string; clientName: string; description: string }) => void;
  onNewClient: () => void;
}

export default function ScopeEditorModal({
  proposalTitle,
  clientName,
  description,
  onClose,
  onSave,
  onNewClient,
}: ScopeEditorModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState<boolean>(false);
  const [title, setTitle] = useState<string>(proposalTitle);
  const [client, setClient] = useState<string>(clientName);
  const [desc, setDesc] = useState<string>(description);

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

  function handleSave(): void {
    if (!title.trim() || title.trim().length < 3) {
      toast.error("Proposal title must be at least 3 characters");
      return;
    }

    if (!client.trim()) {
      toast.error("Client name is required");
      return;
    }

    onSave({
      title: title.trim(),
      clientName: client.trim(),
      description: desc.trim(),
    });
    toast.success("Scope updated successfully");
  }

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Edit Scope</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Proposal Title <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter proposal title"
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Client Name <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWithButton}>
              <input
                type="text"
                className={styles.input}
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Enter client name"
              />
              <button className={styles.newClientButton} onClick={onNewClient}>
                + New Client
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Strategic Prompt Snippet</label>
            <textarea
              className={styles.textarea}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Enter strategic context or instructions for the AI"
              rows={4}
            />
          </div>
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
