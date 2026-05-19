"use client";

import React, { useState, useEffect } from "react";
import { useDraftRecovery } from "@/hooks/useDraftRecovery";
import { DraftRecoveryModal } from "@/components/draft";
import { toast } from "sonner";

export function DashboardWithDraftRecovery(): JSX.Element {
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);

  const {
    availableDrafts,
    isLoadingDrafts,
    recoverDraft,
    isRecovering,
    recoveryError,
  } = useDraftRecovery({
    autoRecover: false,
    onRecoveryComplete: () => {
      toast.success("Draft recovered");
      setShowRecoveryModal(false);
    },
    onRecoveryError: (error) => {
      toast.error(`Failed to recover draft: ${error.message}`);
    },
  });

  useEffect(() => {
    if (!isLoadingDrafts && availableDrafts.length > 0) {
      const hasRecentDraft = availableDrafts.some((draft) => {
        const updatedAt = new Date(draft.updatedAt);
        const hoursSinceUpdate =
          (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate < 24;
      });

      if (hasRecentDraft) {
        setShowRecoveryModal(true);
      }
    }
  }, [isLoadingDrafts, availableDrafts]);

  const handleDismiss = (): void => {
    setShowRecoveryModal(false);
    localStorage.setItem("draftora_dismissed_recovery", Date.now().toString());
  };

  return (
    <div>
      <h1>Dashboard</h1>

      <DraftRecoveryModal
        isOpen={showRecoveryModal}
        drafts={availableDrafts}
        onRecover={recoverDraft}
        onDismiss={handleDismiss}
        isRecovering={isRecovering}
      />

      {recoveryError && (
        <div style={{ color: "red", padding: "10px", marginTop: "10px" }}>
          Error: {recoveryError.message}
        </div>
      )}
    </div>
  );
}
