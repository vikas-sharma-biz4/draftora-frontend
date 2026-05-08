"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Loader2 } from "lucide-react";

import styles from "./DeleteClientModal.module.scss";
import { useModalHistory } from "@/hooks/useModalHistory";

interface DeleteConfirmModalProps {
  title: string;
  itemName: string;
  warningMessage?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteConfirmModal({ 
  title, 
  itemName, 
  warningMessage,
  onClose, 
  onConfirm 
}: DeleteConfirmModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Enable browser back button to close modal
  useModalHistory({ isOpen: true, onClose, modalId: 'delete-confirm-modal' });

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  async function handleConfirm(): Promise<void> {
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.iconWrapper}>
            <AlertTriangle size={24} className={styles.warningIcon} />
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close" disabled={isDeleting}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <p className={styles.modalDescription}>
            Are you sure you want to delete <strong>{itemName}</strong>?
          </p>
          <p className={styles.modalWarning}>
            {warningMessage || "This action cannot be undone."}
          </p>
        </div>

        <div className={styles.modalFooter}>
          <button 
            className="btn btn-secondary" 
            onClick={onClose} 
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            className={`btn ${styles.deleteBtn}`}
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
