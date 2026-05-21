"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Loader2 } from "lucide-react";

import styles from "./DeleteConfirmModal.module.scss";
import { logger } from "@/utils/logger";
import Button from "@/components/common/Button";
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
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  async function handleConfirm(): Promise<void> {
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (error) {
      logger.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.iconWrapper}>
            <AlertTriangle size={24} className={styles.warningIcon} />
          </div>
          <Button
            variant="ghost"
            iconOnly
            onClick={onClose}
            aria-label="Close"
            disabled={isDeleting}
            className={styles.closeBtn}
          >
            <X size={20} />
          </Button>
        </div>

        <div className={styles.modalBody}>
          <h2 id="delete-modal-title" className={styles.modalTitle}>{title}</h2>
          <p className={styles.modalDescription}>
            Are you sure you want to delete <strong>{itemName}</strong>?
          </p>
          <p className={styles.modalWarning}>
            {warningMessage || "This action cannot be undone."}
          </p>
        </div>

        <div className={styles.modalFooter}>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={isDeleting}
            className={styles.deleteBtn}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
