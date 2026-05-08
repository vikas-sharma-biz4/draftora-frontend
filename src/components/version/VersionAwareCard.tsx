import React, { useState } from "react";
import { Edit2, FileText, Info, Save, X } from "lucide-react";
import type { ProposalVersion } from "@/interfaces/versionInterfaces";
import styles from "./VersionAwareCard.module.scss";

interface VersionAwareCardProps {
  sectionKey: string;
  sectionLabel: string;
  content: string;
  version: ProposalVersion;
  onSave?: (sectionKey: string, newContent: string) => Promise<void>;
  onShowSource?: (sectionKey: string) => void;
  onShowReasoning?: (sectionKey: string) => void;
  editable?: boolean;
}

export function VersionAwareCard({
  sectionKey,
  sectionLabel,
  content,
  version,
  onSave,
  onShowSource,
  onShowReasoning,
  editable = true,
}: VersionAwareCardProps): JSX.Element {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedContent, setEditedContent] = useState<string>(content);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleEdit = (): void => {
    setIsEditing(true);
    setEditedContent(content);
  };

  const handleCancel = (): void => {
    setIsEditing(false);
    setEditedContent(content);
  };

  const handleSave = async (): Promise<void> => {
    if (!onSave) {
      return;
    }

    try {
      setIsSaving(true);
      await onSave(sectionKey, editedContent);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <FileText size={18} />
          <h3 className={styles.title}>{sectionLabel}</h3>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.versionBadge}>v{version.version}</span>
          {editable && !isEditing && (
            <button
              onClick={handleEdit}
              className={styles.iconButton}
              title="Edit section"
            >
              <Edit2 size={16} />
            </button>
          )}
          {onShowSource && (
            <button
              onClick={() => onShowSource(sectionKey)}
              className={styles.iconButton}
              title="Show sources"
            >
              <FileText size={16} />
            </button>
          )}
          {onShowReasoning && (
            <button
              onClick={() => onShowReasoning(sectionKey)}
              className={styles.iconButton}
              title="Why this content?"
            >
              <Info size={16} />
            </button>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {isEditing ? (
          <div className={styles.editMode}>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className={styles.textarea}
              rows={10}
              disabled={isSaving}
            />
            <div className={styles.editActions}>
              <button
                onClick={handleCancel}
                className={styles.cancelButton}
                disabled={isSaving}
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSave}
                className={styles.saveButton}
                disabled={isSaving}
              >
                <Save size={16} />
                <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            className={styles.viewMode}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.footerText}>
          {version.source === "generated" && "AI Generated"}
          {version.source === "edited" && "Manually Edited"}
          {version.source === "regenerated" && "Regenerated"}
          {version.parentVersion && ` • Based on v${version.parentVersion}`}
        </span>
      </div>
    </div>
  );
}
