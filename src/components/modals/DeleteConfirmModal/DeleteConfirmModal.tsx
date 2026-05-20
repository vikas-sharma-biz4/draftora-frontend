"use client";

import React, { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";

import styles from "../DeleteClientModal.module.scss";
import { logger } from "@/utils/logger";
import BaseModal from "@/components/common/BaseModal";
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
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Enable browser back button to close modal
  useModalHistory({ isOpen: true, onClose, modalId: 'delete-confirm-modal' });

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

  return (
    <BaseModal isOpen={true} onClose={onClose} size="sm" labelId="delete-modal-title">
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
    </BaseModal>
  );
}
