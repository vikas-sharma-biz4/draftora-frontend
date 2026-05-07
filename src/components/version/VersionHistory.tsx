import React from "react";
import { Check, X, GitCommit, Edit, RefreshCw, Sparkles } from "lucide-react";
import type { ProposalVersion } from "@/types/version.types";
import styles from "./VersionHistory.module.scss";

interface VersionHistoryProps {
  versions: ProposalVersion[];
  selectedVersion: number;
  acceptedVersions: number[];
  rejectedVersions: number[];
  onSelectVersion: (versionNumber: number) => void;
}

export function VersionHistory({
  versions,
  selectedVersion,
  acceptedVersions,
  rejectedVersions,
  onSelectVersion,
}: VersionHistoryProps): JSX.Element {
  const getSourceIcon = (source: ProposalVersion["source"]): JSX.Element => {
    switch (source) {
      case "generated":
        return <Sparkles size={16} />;
      case "edited":
        return <Edit size={16} />;
      case "regenerated":
        return <RefreshCw size={16} />;
      default:
        return <GitCommit size={16} />;
    }
  };

  const getSourceLabel = (source: ProposalVersion["source"]): string => {
    switch (source) {
      case "generated":
        return "AI Generated";
      case "edited":
        return "Manually Edited";
      case "regenerated":
        return "Regenerated";
      default:
        return "Unknown";
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "Just now";
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString();
  };

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Version History</h3>
        <span className={styles.count}>
          {versions.length} version{versions.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className={styles.timeline}>
        {sortedVersions.map((version, index) => {
          const isSelected = version.version === selectedVersion;
          const isAccepted = acceptedVersions.includes(version.version);
          const isRejected = rejectedVersions.includes(version.version);
          const isLast = index === sortedVersions.length - 1;

          return (
            <div
              key={version.id}
              className={`${styles.timelineItem} ${
                isSelected ? styles.timelineItemSelected : ""
              }`}
              onClick={() => onSelectVersion(version.version)}
            >
              <div className={styles.timelineMarker}>
                <div
                  className={`${styles.dot} ${
                    isAccepted
                      ? styles.dotAccepted
                      : isRejected
                      ? styles.dotRejected
                      : styles.dotDefault
                  }`}
                >
                  {isAccepted ? (
                    <Check size={12} />
                  ) : isRejected ? (
                    <X size={12} />
                  ) : (
                    getSourceIcon(version.source)
                  )}
                </div>
                {!isLast && <div className={styles.line} />}
              </div>

              <div className={styles.content}>
                <div className={styles.contentHeader}>
                  <span className={styles.versionNumber}>
                    Version {version.version}
                  </span>
                  {isAccepted && (
                    <span className={styles.statusAccepted}>Accepted</span>
                  )}
                  {isRejected && (
                    <span className={styles.statusRejected}>Rejected</span>
                  )}
                </div>

                <p className={styles.sourceLabel}>
                  {getSourceLabel(version.source)}
                  {version.parentVersion && (
                    <> • Based on v{version.parentVersion}</>
                  )}
                </p>

                {version.changeDescription && (
                  <p className={styles.description}>
                    {version.changeDescription}
                  </p>
                )}

                <span className={styles.timestamp}>
                  {formatDate(version.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
