"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { toast } from "@/utils/toast";

import styles from "../EditModal.module.scss";
import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import { Select } from "@/components/common/Input";
import FormField from "@/components/common/FormField";
import { TONE_OPTIONS, LENGTH_OPTIONS, LANGUAGE_OPTIONS } from "@/constants";
import type { ToneOption, LengthOption } from "@/interfaces/proposalInterfaces";

interface StyleVoiceEditorModalProps {
  tone: ToneOption;
  lengthPreference: LengthOption;
  language: string;
  onClose: () => void;
  onSave: (data: { tone: ToneOption; lengthPreference: LengthOption; language: string }) => void;
}

export default function StyleVoiceEditorModal({
  tone,
  lengthPreference,
  language,
  onClose,
  onSave,
}: StyleVoiceEditorModalProps): JSX.Element | null {
  const [selectedTone, setSelectedTone] = useState<ToneOption>(tone);
  const [selectedLength, setSelectedLength] = useState<LengthOption>(lengthPreference);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);

  function handleSave(): void {
    onSave({
      tone: selectedTone,
      lengthPreference: selectedLength,
      language: selectedLanguage,
    });
    toast.success("Style & voice updated");
  }

  return (
    <BaseModal isOpen={true} onClose={onClose} size="md" labelId="style-modal-title">
        <div className={styles.modalHeader}>
          <h2 id="style-modal-title" className={styles.modalTitle}>Edit Style &amp; Voice</h2>
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

          <FormField label="Language">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <div className={styles.previewBox}>
            <div className={styles.previewLabel}>Preview</div>
            <div className={styles.previewText}>
              <strong>Tone:</strong> {TONE_OPTIONS.find(o => o.value === selectedTone)?.label} •{" "}
              <strong>Length:</strong> {LENGTH_OPTIONS.find(o => o.value === selectedLength)?.label} •{" "}
              <strong>Language:</strong> {selectedLanguage}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose} className={styles.cancelButton}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} className={styles.saveButton}>
            Save Changes
          </Button>
        </div>
    </BaseModal>
  );
}
