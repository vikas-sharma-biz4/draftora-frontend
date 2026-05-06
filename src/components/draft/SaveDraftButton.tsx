import React from "react";
import { Save, Check, Loader2 } from "lucide-react";
import styles from "./SaveDraftButton.module.scss";

interface SaveDraftButtonProps {
  onSave: () => void;
  isSaving: boolean;
  lastSaved: Date | null;
  variant?: "primary" | "secondary" | "ghost";
  showLastSaved?: boolean;
  disabled?: boolean;
}

export function SaveDraftButton({
  onSave,
  isSaving,
  lastSaved,
  variant = "secondary",
  showLastSaved = true,
  disabled = false,
}: SaveDraftButtonProps): JSX.Element {
  const getTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 10) {
      return "Just now";
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    return date.toLocaleDateString();
  };

  const buttonClass = `${styles.button} ${styles[variant]}`;

  return (
    <div className={styles.container}>
      <button
        onClick={onSave}
        className={buttonClass}
        disabled={disabled || isSaving}
        aria-label="Save draft"
      >
        {isSaving ? (
          <>
            <Loader2 size={16} className={styles.spinning} />
            <span>Saving...</span>
          </>
        ) : lastSaved ? (
          <>
            <Check size={16} />
            <span>Saved</span>
          </>
        ) : (
          <>
            <Save size={16} />
            <span>Save Draft</span>
          </>
        )}
      </button>
      {showLastSaved && lastSaved && !isSaving && (
        <span className={styles.lastSaved}>{getTimeAgo(lastSaved)}</span>
      )}
    </div>
  );
}
