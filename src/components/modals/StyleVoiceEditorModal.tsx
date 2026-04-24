"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";

import styles from "./EditModal.module.scss";
import { TONE_OPTIONS, LENGTH_OPTIONS, LANGUAGE_OPTIONS } from "@/constants";

interface StyleVoiceEditorModalProps {
  tone: string;
  lengthPreference: string;
  language: string;
  onClose: () => void;
  onSave: (data: { tone: string; lengthPreference: string; language: string }) => void;
}

export default function StyleVoiceEditorModal({
  tone,
  lengthPreference,
  language,
  onClose,
  onSave,
}: StyleVoiceEditorModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState<boolean>(false);
  const [selectedTone, setSelectedTone] = useState<string>(tone);
  const [selectedLength, setSelectedLength] = useState<string>(lengthPreference);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  function handleSave(): void {
    onSave({
      tone: selectedTone,
      lengthPreference: selectedLength,
      language: selectedLanguage,
    });
    toast.success("Style & voice updated successfully");
  }

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Edit Style & Voice</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
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

          <div className={styles.formGroup}>
            <label className={styles.label}>Language</label>
            <select
              className={styles.select}
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

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
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
