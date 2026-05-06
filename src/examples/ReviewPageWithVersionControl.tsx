"use client";

import React, { useState } from "react";
import { useVersionControl } from "@/hooks/useVersionControl";
import {
  VersionSelector,
  VersionHistory,
  VersionAwareCard,
} from "@/components/version";
import { toast } from "sonner";
import type { ProposalVersion } from "@/types/version.types";
import styles from "./ReviewPageWithVersionControl.module.scss";

interface ReviewPageWithVersionControlProps {
  proposalId: number;
}

export function ReviewPageWithVersionControl({
  proposalId,
}: ReviewPageWithVersionControlProps): JSX.Element {
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const {
    versionHistory,
    selectedVersion,
    isLoading,
    error,
    selectVersion,
    acceptVersion,
    rejectVersion,
    regenerateVersion,
    saveEdits,
    isVersionAccepted,
    isVersionRejected,
  } = useVersionControl({
    proposalId,
    autoLoadHistory: true,
    onVersionChange: (version: ProposalVersion) => {
      toast.success(`Switched to version ${version.version}`);
    },
    onDecisionUpdate: (versionId: string, decision: string) => {
      toast.success(`Version ${decision}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAccept = async (versionId: string): Promise<void> => {
    await acceptVersion(versionId);
  };

  const handleReject = async (versionId: string): Promise<void> => {
    await rejectVersion(versionId);
  };

  const handleSaveEdit = async (
    sectionKey: string,
    newContent: string
  ): Promise<void> => {
    if (!selectedVersion) {
      return;
    }

    const editedContent = {
      ...selectedVersion.snapshot.generatedContent,
      [sectionKey]: newContent,
    };

    await saveEdits(selectedVersion.id, editedContent);
    toast.success("Changes saved as new version");
  };

  const handleRegenerate = async (): Promise<void> => {
    if (!selectedVersion) {
      return;
    }

    try {
      const result = await regenerateVersion(selectedVersion.id, {
        tone: "professional",
      });
      toast.success(`New version ${result.versionId} created`);
    } catch (error) {
      console.error("Regeneration failed:", error);
    }
  };

  if (isLoading && !versionHistory) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading version history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>Error: {error.message}</p>
      </div>
    );
  }

  if (!versionHistory || !selectedVersion) {
    return (
      <div className={styles.empty}>
        <p>No versions available</p>
      </div>
    );
  }

  const sections = Object.entries(
    selectedVersion.snapshot.generatedContent || {}
  );

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <VersionSelector
          versions={versionHistory.versions}
          selectedVersion={selectedVersion.version}
          currentVersion={versionHistory.currentVersion}
          acceptedVersions={versionHistory.acceptedVersions}
          rejectedVersions={versionHistory.rejectedVersions}
          onSelectVersion={selectVersion}
          onAccept={handleAccept}
          onReject={handleReject}
        />

        <button
          onClick={() => setShowHistory(!showHistory)}
          className={styles.historyToggle}
        >
          {showHistory ? "Hide" : "Show"} History
        </button>

        {showHistory && (
          <VersionHistory
            versions={versionHistory.versions}
            selectedVersion={selectedVersion.version}
            acceptedVersions={versionHistory.acceptedVersions}
            rejectedVersions={versionHistory.rejectedVersions}
            onSelectVersion={selectVersion}
          />
        )}

        <div className={styles.actions}>
          <button onClick={handleRegenerate} className={styles.regenerateBtn}>
            Regenerate from this version
          </button>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            {selectedVersion.snapshot.proposalData.title}
          </h1>
          <p className={styles.subtitle}>
            Client: {selectedVersion.snapshot.proposalData.clientName}
          </p>
        </div>

        <div className={styles.sections}>
          {sections.map(([sectionKey, content]) => {
            const sectionLabel =
              selectedVersion.snapshot.proposalData.sectionDisplayNames?.[
                sectionKey
              ] || sectionKey;

            return (
              <VersionAwareCard
                key={sectionKey}
                sectionKey={sectionKey}
                sectionLabel={sectionLabel}
                content={content}
                version={selectedVersion}
                onSave={handleSaveEdit}
                editable={true}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
