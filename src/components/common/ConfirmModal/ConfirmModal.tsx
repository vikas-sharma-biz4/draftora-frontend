"use client";

import { useState } from "react";
import React from "react";
import { logger } from "@/utils/logger";
import { toast } from "@/utils/toast";
import { MESSAGES } from "@/constants/messages";

import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import styles from "./ConfirmModal.module.scss";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = "Confirm",
  message,
  onConfirm,
  onCancel,
}: ConfirmModalProps): JSX.Element | null {
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleConfirm(): Promise<void> {
    setIsConfirming(true);
    try {
      await onConfirm();
    } catch (error) {
      logger.error("[ConfirmModal] Error in onConfirm:", error);
      toast.error(MESSAGES.GENERIC_ERROR);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <BaseModal isOpen={isOpen} onClose={onCancel} size="sm" labelId="confirm-modal-title">
      <div className={styles.body}>
        {title && (
          <h3 id="confirm-modal-title" className={styles.title}>{title}</h3>
        )}
        <p className={styles.message}>{message}</p>
        <div className={styles.footer}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            loading={isConfirming}
          >
            Confirm
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
