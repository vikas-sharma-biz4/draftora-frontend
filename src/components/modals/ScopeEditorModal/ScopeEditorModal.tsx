"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { toast } from "@/utils/toast";

import styles from "../EditModal.module.scss";
import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import { Input, Textarea } from "@/components/common/Input";
import FormField from "@/components/common/FormField";

interface ScopeEditorModalProps {
  proposalTitle: string;
  clientName: string;
  clientId: number | null;
  description: string;
  onClose: () => void;
  onSave: (data: {
    title: string;
    clientName: string;
    clientId: number | null;
    description: string;
  }) => void;
}

export default function ScopeEditorModal({
  proposalTitle,
  clientName,
  clientId,
  description,
  onClose,
  onSave,
}: ScopeEditorModalProps): JSX.Element | null {
  const [title, setTitle] = useState<string>(proposalTitle);
  const [desc, setDesc] = useState<string>(description);

  function handleSave(): void {
    if (!title.trim() || title.trim().length < 3) {
      toast.error("Proposal title must be at least 3 characters");
      return;
    }

    onSave({
      title: title.trim(),
      clientName: clientName.trim(),
      clientId,
      description: desc.trim(),
    });
  }

  return (
    <BaseModal isOpen={true} onClose={onClose} size="md" labelId="scope-modal-title">
      <div className={styles.modalHeader}>
        <h2 id="scope-modal-title" className={styles.modalTitle}>
          Edit Client Details
        </h2>
        <Button
          variant="ghost"
          iconOnly
          onClick={onClose}
          aria-label="Close"
          className={styles.closeButton}
        >
          <X size={20} />
        </Button>
      </div>

      <div className={styles.modalBody}>
        <FormField label="Proposal Title *">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter proposal title"
              autoFocus
            />
          )}
        </FormField>

        <FormField label="Client Name">
          {(fieldProps) => <Input {...fieldProps} type="text" value={clientName} readOnly />}
        </FormField>

        <FormField label="Strategic Prompt Snippet">
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Enter strategic context or instructions for the AI"
              rows={4}
            />
          )}
        </FormField>
      </div>

      <div className={styles.modalFooter}>
        <Button variant="primary" onClick={handleSave} className={styles.saveButton}>
          Save Changes
        </Button>
      </div>
    </BaseModal>
  );
}
