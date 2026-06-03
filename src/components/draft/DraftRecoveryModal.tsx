import React from "react";
import { X, Clock, FileText } from "lucide-react";
import type { DraftMetadata } from "@/interfaces/draftInterfaces";
import { formatRelativeTime } from "@/utils/formatters";
import styles from "./DraftRecoveryModal.module.scss";

interface DraftRecoveryModalProps {
  isOpen: boolean;
  drafts: DraftMetadata[];
  onRecover: (draftId: string) => void;
  onDismiss: () => void;
  isRecovering: boolean;
}

export function DraftRecoveryModal({
  isOpen,
  drafts,
  onRecover,
  onDismiss,
  isRecovering,
}: DraftRecoveryModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  const getLocationLabel = (location: DraftMetadata["lastLocation"]): string => {
    switch (location) {
      case "wizard_parameters":
        return "Parameters Step";
      case "wizard_review":
        return "Review Step";
      case "web_view":
        return "Generated Proposal";
      case "ai_sections":
        return "AI Generation";
      default:
        return "Unknown";
    }
  };

  const getStatusBadge = (status: DraftMetadata["status"]): JSX.Element => {
    const statusMap = {
      draft: { label: "Draft", className: styles.statusDraft },
      generating: { label: "Generating", className: styles.statusGenerating },
      completed: { label: "Completed", className: styles.statusCompleted },
      pending_approval: { label: "Pending", className: styles.statusCompleted },
    };

    const { label, className } = statusMap[status];
    return <span className={className}>{label}</span>;
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Resume Your Work</h2>
          <button
            onClick={onDismiss}
            className={styles.closeButton}
            aria-label="Close modal"
            disabled={isRecovering}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            We found {drafts.length} unsaved draft{drafts.length > 1 ? "s" : ""}. Would you like to
            continue where you left off?
          </p>

          <div className={styles.draftList}>
            {drafts.map((draft) => (
              <div key={draft.id} className={styles.draftCard}>
                <div className={styles.draftIcon}>
                  <FileText size={24} />
                </div>
                <div className={styles.draftInfo}>
                  <h3 className={styles.draftTitle}>{draft.title}</h3>
                  <p className={styles.draftClient}>{draft.clientName}</p>
                  <div className={styles.draftMeta}>
                    <span className={styles.location}>{getLocationLabel(draft.lastLocation)}</span>
                    <span className={styles.separator}></span>
                    {getStatusBadge(draft.status)}
                  </div>
                  <div className={styles.draftTime}>
                    <Clock size={14} />
                    <span>{formatRelativeTime(draft.updatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => onRecover(draft.id)}
                  className={styles.recoverButton}
                  disabled={isRecovering}
                >
                  {isRecovering ? "Recovering..." : "Resume"}
                </button>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button onClick={onDismiss} className={styles.dismissButton} disabled={isRecovering}>
              Start Fresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
