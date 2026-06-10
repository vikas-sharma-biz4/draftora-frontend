"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import styles from "../EditModal.module.scss";
import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import { TONE_OPTIONS, LENGTH_OPTIONS } from "@/constants";
import type { ToneOption, LengthOption } from "@/interfaces/proposalInterfaces";

interface StyleVoiceEditorModalProps {
  tone: ToneOption;
  lengthPreference: LengthOption;
  onClose: () => void;
  onSave: (data: { tone: ToneOption; lengthPreference: LengthOption }) => void;
}

export default function StyleVoiceEditorModal({
  tone,
  lengthPreference,
  onClose,
  onSave,
}: StyleVoiceEditorModalProps): JSX.Element | null {
  const [selectedTone, setSelectedTone] = useState<ToneOption>(tone);
  const [selectedLength, setSelectedLength] = useState<LengthOption>(lengthPreference);

  function handleSave(): void {
    onSave({
      tone: selectedTone,
      lengthPreference: selectedLength,
    });
  }

  return (
    <BaseModal isOpen={true} onClose={onClose} size="md" labelId="style-modal-title">
      <div className={styles.modalHeader}>
        <h2 id="style-modal-title" className={styles.modalTitle}>
          Edit Style &amp; Voice
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
        <div className={styles.formGroup}>
          <label className={styles.label}>Tone</label>
          <div className={styles.optionGrid}>
            {TONE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`${styles.optionCard} ${selectedTone === option.value ? styles.selected : ""}`}
                onClick={() => setSelectedTone(option.value)}
              >
                <span className={styles.optionIcon}>{option.icon}</span>
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={styles.optionDesc}>{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Length</label>
          <div className={styles.segmentedControl}>
            {LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`${styles.segmentButton} ${selectedLength === option.value ? styles.active : ""}`}
                onClick={() => setSelectedLength(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.modalFooter}>
        <Button variant="primary" onClick={handleSave} className={styles.saveButton}>
          Save Changes
        </Button>
      </div>
    </BaseModal>
  );
}
