"use client";

import { useId, useState, useEffect } from "react";
import { X } from "lucide-react";
import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import type { EstimatedHoursData } from "@/interfaces/proposalInterfaces";
import editStyles from "@/components/modals/EditModal.module.scss";
import styles from "./EstimateHoursModal.module.scss";

interface EstimateHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (customFeatureList?: string, customPrompt?: string) => void;
  defaultFeatureList: string;
  previousEstimate: EstimatedHoursData | null;
  isSubmitting?: boolean;
}

export default function EstimateHoursModal({
  isOpen,
  onClose,
  onSubmit,
  defaultFeatureList,
  previousEstimate,
  isSubmitting = false,
}: EstimateHoursModalProps): JSX.Element | null {
  const titleId = useId();

  const [customPrompt, setCustomPrompt] = useState<string>(
    previousEstimate?.customPromptUsed ?? ""
  );

  useEffect(() => {
    if (isOpen) {
      setCustomPrompt(previousEstimate?.customPromptUsed ?? "");
    }
  }, [isOpen, previousEstimate]);

  function handleSubmit(): void {
    const listToSend = previousEstimate?.featureListUsed || defaultFeatureList || undefined;
    const promptToSend = customPrompt.trim() || undefined;
    onSubmit(listToSend, promptToSend);
  }

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      labelId={`${titleId}-label`}
      closeOnOverlayClick
    >
      <div className={editStyles.modalHeader}>
        <div>
          <h2 id={`${titleId}-label`} className={editStyles.modalTitle}>
            {previousEstimate ? "Re-estimate Development Hours" : "Estimate Development Hours"}
          </h2>
          <p className={editStyles.modalSubtitle}>
            Add custom instructions to refine the hour estimation.
          </p>
        </div>
        <Button variant="ghost" iconOnly onClick={onClose} aria-label="Close modal">
          <X size={20} />
        </Button>
      </div>

      <div className={editStyles.modalBody}>
        <div className={editStyles.formGroup}>
          <label htmlFor={`${titleId}-custom-prompt`} className={editStyles.label}>
            Custom Instructions
            <span className={styles.optional}> (optional)</span>
          </label>
          <p className={styles.fieldHint}>
            Add context or constraints, e.g. &ldquo;include mobile app development&rdquo;.
          </p>
          <textarea
            id={`${titleId}-custom-prompt`}
            className={editStyles.textarea}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            placeholder="e.g. Include React Native mobile app, assume 2 backend developers..."
          />
        </div>
      </div>

      <div className={editStyles.modalFooter}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {previousEstimate ? "Re-estimate Hours" : "Calculate Hours"}
        </Button>
      </div>
    </BaseModal>
  );
}
