/**
 * AddSectionModal
 *
 * Reusable modal for adding a new section to a proposal.
 * Accepts a section name (required) and AI instructions (optional).
 * Validates name uniqueness and length before calling onSubmit.
 */

"use client";

import { useCallback, useId, useState } from "react";
import { X } from "lucide-react";

import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import { Input, Textarea } from "@/components/common/Input";
import FormField from "@/components/common/FormField";
import { MESSAGES } from "@/constants/messages";
import styles from "../EditModal.module.scss";

const MAX_SECTION_NAME_LENGTH = 60;

function buildSectionKey(name: string): string {
  return (
    "custom_" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40)
  );
}

interface AddSectionModalProps {
  isOpen: boolean;
  /** Whether AI generation is in-progress — disables form + shows spinner */
  isGenerating: boolean;
  /** Existing section keys for duplicate detection */
  existingKeys: string[];
  /** Label of the section after which this new one will be inserted */
  insertAfterLabel?: string;
  onClose: () => void;
  /** Called with (sectionName, instructions) when the user submits */
  onSubmit: (name: string, instructions: string) => Promise<void>;
}

export default function AddSectionModal({
  isOpen,
  isGenerating,
  existingKeys,
  insertAfterLabel,
  onClose,
  onSubmit,
}: AddSectionModalProps): JSX.Element | null {
  const titleId = useId();
  const [sectionName, setSectionName] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [nameError, setNameError] = useState<string>("");

  function validate(): boolean {
    const trimmed = sectionName.trim();
    if (!trimmed) {
      setNameError(MESSAGES.VALIDATION_REQUIRED);
      return false;
    }
    if (trimmed.length > MAX_SECTION_NAME_LENGTH) {
      setNameError(MESSAGES.VALIDATION_MAX_LENGTH(MAX_SECTION_NAME_LENGTH));
      return false;
    }
    if (existingKeys.includes(buildSectionKey(trimmed))) {
      setNameError(MESSAGES.PROPOSAL_SECTION_NAME_EXISTS);
      return false;
    }
    setNameError("");
    return true;
  }

  async function handleSubmit(): Promise<void> {
    if (!validate()) return;
    await onSubmit(sectionName.trim(), instructions.trim());
    setSectionName("");
    setInstructions("");
    setNameError("");
  }

  const handleClose = useCallback((): void => {
    if (isGenerating) return;
    setSectionName("");
    setInstructions("");
    setNameError("");
    onClose();
  }, [isGenerating, onClose]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      labelId={`${titleId}-label`}
      closeOnOverlayClick={!isGenerating}
    >
      <div className={styles.modalHeader}>
        <div>
          <h2 id={`${titleId}-label`} className={styles.modalTitle}>
            Add New Section
          </h2>
          {insertAfterLabel && (
            <p className={styles.modalSubtitle}>
              Inserting after: <strong>{insertAfterLabel}</strong>
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          iconOnly
          onClick={handleClose}
          aria-label="Close modal"
          disabled={isGenerating}
        >
          <X size={20} />
        </Button>
      </div>

      <div className={styles.modalBody}>
        <FormField
          label="Section Name *"
          error={nameError}
          hint='e.g. "Architecture", "Deployment Strategy", "Security Considerations"'
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              value={sectionName}
              onChange={(e) => {
                setSectionName(e.target.value);
                if (nameError) setNameError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isGenerating) void handleSubmit();
              }}
              placeholder="Enter section name"
              maxLength={MAX_SECTION_NAME_LENGTH + 10}
              autoFocus
              disabled={isGenerating}
            />
          )}
        </FormField>

        <FormField
          label="AI Instructions"
          hint="Provide guidance for the AI to generate this section's content."
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Provide instructions for generating this section… e.g. Focus on scalability, Include AWS deployment strategy, Write in enterprise tone, Include milestones"
              rows={4}
              disabled={isGenerating}
            />
          )}
        </FormField>
      </div>

      <div className={styles.modalFooter}>
        <Button
          variant="secondary"
          onClick={handleClose}
          disabled={isGenerating}
          className={styles.cancelButton}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          loading={isGenerating}
          disabled={!sectionName.trim()}
          className={styles.saveButton}
        >
          {isGenerating ? (
            "Adding\u2026"
          ) : (
            "Add Section"
          )}
        </Button>
      </div>
    </BaseModal>
  );
}
