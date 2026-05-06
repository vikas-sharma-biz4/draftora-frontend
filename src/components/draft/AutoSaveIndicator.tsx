import React from "react";
import { Cloud, CloudOff, Check, Loader2 } from "lucide-react";
import styles from "./AutoSaveIndicator.module.scss";

interface AutoSaveIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  hasError?: boolean;
  errorMessage?: string;
}

export function AutoSaveIndicator({
  isSaving,
  lastSaved,
  hasError = false,
  errorMessage,
}: AutoSaveIndicatorProps): JSX.Element {
  const getTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 10) {
      return "Saved just now";
    }
    if (seconds < 60) {
      return `Saved ${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `Saved ${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `Saved ${hours}h ago`;
    }

    return `Saved on ${date.toLocaleDateString()}`;
  };

  if (hasError) {
    return (
      <div className={`${styles.indicator} ${styles.error}`} title={errorMessage}>
        <CloudOff size={16} />
        <span>Save failed</span>
      </div>
    );
  }

  if (isSaving) {
    return (
      <div className={`${styles.indicator} ${styles.saving}`}>
        <Loader2 size={16} className={styles.spinning} />
        <span>Saving...</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className={`${styles.indicator} ${styles.saved}`}>
        <Check size={16} />
        <span>{getTimeAgo(lastSaved)}</span>
      </div>
    );
  }

  return (
    <div className={`${styles.indicator} ${styles.idle}`}>
      <Cloud size={16} />
      <span>Auto-save enabled</span>
    </div>
  );
}
