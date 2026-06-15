"use client";

import { useRef, useState } from "react";
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
  onConfirm: (signal: AbortSignal) => void | Promise<void>;
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
  const abortControllerRef = useRef<AbortController | null>(null);

  async function handleConfirm(): Promise<void> {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsConfirming(true);
    try {
      await onConfirm(controller.signal);
    } catch (error) {
      logger.error("[ConfirmModal] Error in onConfirm:", error);
      toast.error(MESSAGES.GENERIC_ERROR);
    } finally {
      abortControllerRef.current = null;
      setIsConfirming(false);
    }
  }

  function handleCancel(): void {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    onCancel();
  }

  return (
    <BaseModal isOpen={isOpen} onClose={handleCancel} size="sm" labelId="confirm-modal-title">
      <div className={styles.body}>
        {title && (
          <h3 id="confirm-modal-title" className={styles.title}>
            {title}
          </h3>
        )}
        <p className={styles.message}>{message}</p>
        <div className={styles.footer}>
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} loading={isConfirming}>
            Confirm
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
