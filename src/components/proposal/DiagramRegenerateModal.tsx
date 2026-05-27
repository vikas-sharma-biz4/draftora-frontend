"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";

import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import styles from "@/components/modals/EditModal.module.scss";

interface DiagramRegenerateModalProps {
  imageUrls: string[];
  isRegenerating: boolean;
  onClose: () => void;
  onSubmit: (imageInstructions: string[]) => void;
}

/**
 * Modal for regenerating multi-image diagram sections (e.g. user_flow).
 * Shows a thumbnail preview + instruction input for each image.
 * Instructions are optional per-image; all are sent to the backend together.
 */
export default function DiagramRegenerateModal({
  imageUrls,
  isRegenerating,
  onClose,
  onSubmit,
}: DiagramRegenerateModalProps): JSX.Element {
  const titleId = useId();
  const [instructions, setInstructions] = useState<string[]>(imageUrls.map(() => ""));

  function handleInstructionChange(idx: number, value: string): void {
    setInstructions(prev => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  }

  function handleSubmit(): void {
    onSubmit(instructions);
  }

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      size="md"
      labelId={`${titleId}-label`}
      closeOnOverlayClick={!isRegenerating}
    >
      <div className={styles.modalHeader}>
        <h2 id={`${titleId}-label`} className={styles.modalTitle}>
          Regenerate Diagrams
        </h2>
        <Button
          variant="ghost"
          iconOnly
          onClick={onClose}
          aria-label="Close modal"
          disabled={isRegenerating}
        >
          <X size={20} />
        </Button>
      </div>

      <div className={styles.modalBody}>
        {imageUrls.map((url, idx) => (
          <div key={idx} className="diagram-regen-modal-item">
            <div className="diagram-regen-thumbnail">
              <img
                src={url}
                alt={`Diagram ${idx + 1}`}
                loading="lazy"
              />
              <span className="diagram-regen-label">Image {idx + 1}</span>
            </div>
            <div style={{ flex: 1 }}>
              <label
                htmlFor={`${titleId}-instr-${idx}`}
                className={styles.label}
              >
                Changes for Image {idx + 1}
                <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 4 }}>
                  (optional)
                </span>
              </label>
              <textarea
                id={`${titleId}-instr-${idx}`}
                className={styles.textarea}
                rows={3}
                placeholder={`e.g. Add Redis cache, change database from PostgreSQL to MySQL…`}
                value={instructions[idx]}
                onChange={e => handleInstructionChange(idx, e.target.value)}
                disabled={isRegenerating}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.modalFooter}>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isRegenerating}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={isRegenerating}
          onClick={handleSubmit}
        >
          {isRegenerating ? "Regenerating…" : "Regenerate"}
        </Button>
      </div>
    </BaseModal>
  );
}
