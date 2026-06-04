import React from "react";
import { Check, X, ChevronDown, GitBranch } from "lucide-react";
import type { ProposalVersion } from "@/interfaces/versionInterfaces";
import { formatDateWithTime } from "@/utils/dateUtils";
import styles from "./VersionSelector.module.scss";

interface VersionSelectorProps {
  versions: ProposalVersion[];
  selectedVersion: number;
  currentVersion: number;
  acceptedVersions: number[];
  rejectedVersions: number[];
  onSelectVersion: (versionNumber: number) => void;
  onAccept: (versionId: string) => void;
  onReject: (versionId: string) => void;
  disabled?: boolean;
}

export function VersionSelector({
  versions,
  selectedVersion,
  currentVersion,
  acceptedVersions,
  rejectedVersions,
  onSelectVersion,
  onAccept,
  onReject,
  disabled = false,
}: VersionSelectorProps): JSX.Element {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const selectedVersionData = versions.find((v) => v.version === selectedVersion);

  const getVersionBadge = (versionNumber: number): JSX.Element | null => {
    if (acceptedVersions.includes(versionNumber)) {
      return <span className={styles.badgeAccepted}>Accepted</span>;
    }
    if (rejectedVersions.includes(versionNumber)) {
      return <span className={styles.badgeRejected}>Rejected</span>;
    }
    return null;
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

  const handleAccept = (e: React.MouseEvent, versionId: string): void => {
    e.stopPropagation();
    onAccept(versionId);
  };

  const handleReject = (e: React.MouseEvent, versionId: string): void => {
    e.stopPropagation();
    onReject(versionId);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <GitBranch size={18} />
        <span className={styles.label}>Version Control</span>
      </div>

      <div className={styles.selectorWrapper}>
        <button onClick={() => setIsOpen(!isOpen)} className={styles.trigger} disabled={disabled}>
          <div className={styles.triggerContent}>
            <span className={styles.versionNumber}>v{selectedVersion}</span>
            {selectedVersionData && (
              <span className={styles.versionSource}>
                {getSourceLabel(selectedVersionData.source)}
              </span>
            )}
            {getVersionBadge(selectedVersion)}
          </div>
          <ChevronDown
            size={16}
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          />
        </button>

        {isOpen && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <span>Select Version</span>
              <span className={styles.versionCount}>
                {versions.length} version{versions.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className={styles.versionList}>
              {versions
                .sort((a, b) => b.version - a.version)
                .map((version) => {
                  const isSelected = version.version === selectedVersion;
                  const isCurrent = version.version === currentVersion;
                  const isAccepted = acceptedVersions.includes(version.version);
                  const isRejected = rejectedVersions.includes(version.version);

                  return (
                    <div
                      key={version.id}
                      className={`${styles.versionItem} ${
                        isSelected ? styles.versionItemSelected : ""
                      }`}
                      onClick={() => {
                        onSelectVersion(version.version);
                        setIsOpen(false);
                      }}
                    >
                      <div className={styles.versionInfo}>
                        <div className={styles.versionHeader}>
                          <span className={styles.versionNum}>v{version.version}</span>
                          {isCurrent && <span className={styles.currentBadge}>Latest</span>}
                          {getVersionBadge(version.version)}
                        </div>
                        <span className={styles.versionMeta}>
                          {getSourceLabel(version.source)}
                          {version.parentVersion && <> Based on v{version.parentVersion}</>}
                        </span>
                        {version.changeDescription && (
                          <p className={styles.changeDesc}>{version.changeDescription}</p>
                        )}
                        <span className={styles.versionDate}>
                          {formatDateWithTime(version.createdAt)}
                        </span>
                      </div>

                      <div className={styles.versionActions}>
                        {!isAccepted && !isRejected && (
                          <>
                            <button
                              onClick={(e) => handleAccept(e, version.id)}
                              className={styles.acceptButton}
                              title="Accept this version"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={(e) => handleReject(e, version.id)}
                              className={styles.rejectButton}
                              title="Reject this version"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {isOpen && <div className={styles.overlay} onClick={() => setIsOpen(false)} />}
    </div>
  );
}
