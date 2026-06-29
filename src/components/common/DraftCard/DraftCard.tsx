"use client";

import { Clock, Download, FileText, Loader2, Trash2 } from "lucide-react";

import Button from "@/components/common/Button";
import Card from "@/components/common/Card";
import { PROPOSAL_TEMPLATES } from "@/constants";
import { MESSAGES } from "@/constants/messages";
import type { DraftMetadata } from "@/interfaces/draftInterfaces";
import { getDraftTemplateMeta } from "@/utils/draftTemplateCache";
import { formatDateWithTime } from "@/utils/dateUtils";

import styles from "./DraftCard.module.scss";

interface DraftCardProps {
  draft: DraftMetadata;
  loadingDraftId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string, title: string, e: React.MouseEvent) => void;
  isDownloadingDocx?: boolean;
  isDownloadingPdf?: boolean;
  onDownloadDocx?: () => void;
  onDownloadPdf?: () => void;
}

function getStatusLabel(status: string): string {
  if (status === "draft") return "Draft";
  if (status === "generating") return "Generating";
  if (status === "completed") return "Completed";
  return "In Progress";
}

function getLocationLabel(location: string): string {
  switch (location) {
    case "wizard_parameters":
      return "Parameters";
    case "wizard_review":
      return "Review";
    case "web_view":
      return "Generated";
    case "ai_sections":
      return "AI Generation";
    default:
      return "Unknown";
  }
}

export default function DraftCard({
  draft,
  loadingDraftId,
  onLoad,
  onDelete,
  isDownloadingDocx = false,
  isDownloadingPdf = false,
  onDownloadDocx,
  onDownloadPdf,
}: DraftCardProps): JSX.Element {
  const templateMeta = getDraftTemplateMeta(draft.id);
  const templateId = templateMeta?.templateId ?? draft.templateId;
  const templateType = templateMeta?.templateType ?? draft.templateType;

  const templateName = (() => {
    if (templateId) {
      return PROPOSAL_TEMPLATES.find((t) => t.id === templateId)?.name ?? "Template";
    }
    if (templateType === "scratch" || (!templateId && !templateType)) return "From Scratch";
    // Generated proposals often only have templateType (not templateId) — look up by type
    if (templateType) {
      return PROPOSAL_TEMPLATES.find((t) => t.templateType === templateType)?.name ?? null;
    }
    return null;
  })();

  const isGenerated = draft.stage === "generated";
  const canDownload = draft.proposalId !== null;

  return (
    <article className={styles.card} data-testid="draft-card">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.icon}>
            <FileText size={20} />
          </div>
          <div className={styles.title}>{draft.title || "Untitled Proposal"}</div>
        </div>
        <div className={styles.headerRight}>
          <Button
            variant="ghost"
            iconOnly
            onClick={(e) => onDelete(draft.id, draft.title || "Untitled Proposal", e)}
            aria-label="Delete draft"
            title="Delete this draft"
            className={styles.deleteBtn}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className={styles.body}>
        {draft.clientName && (
          <div className={styles.client}>
            <span className={styles.clientLabel}>Client:</span>
            <span className={styles.clientName}>{draft.clientName}</span>
          </div>
        )}
        <div className={styles.meta}>
          <span className={styles.status}>
            <span className={styles.statusDot} />
            {getStatusLabel(draft.status)}
          </span>
          <span className={styles.date}>
            <Clock size={13} />
            {formatDateWithTime(draft.updatedAt)}
          </span>
        </div>
        {templateName && <div className={styles.template}>{templateName}</div>}
        <div className={styles.location}>Step: {getLocationLabel(draft.lastLocation)}</div>
        {isGenerated && <div className={styles.generated}>Generated Proposal Available</div>}
      </div>

      <Card.Footer className={styles.footer}>
        <Button
          variant="secondary"
          size="sm"
          disabled={loadingDraftId === draft.id}
          onClick={(e) => {
            e.stopPropagation();
            onLoad(draft.id);
          }}
          className={styles.resumeBtn}
        >
          Resume Editing
        </Button>
        <span
          className={styles.downloadBtnWrapper}
          title={!canDownload ? MESSAGES.DRAFT_DOWNLOAD_NOT_READY : undefined}
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={!canDownload || isDownloadingDocx}
            onClick={(e) => {
              e.stopPropagation();
              onDownloadDocx?.();
            }}
            aria-label="Download DOCX"
            className={styles.downloadBtn}
          >
            {isDownloadingDocx ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}{" "}
            {isDownloadingDocx ? "..." : "DOCX"}
          </Button>
        </span>
        <span
          className={styles.downloadBtnWrapper}
          title={!canDownload ? MESSAGES.DRAFT_DOWNLOAD_NOT_READY : undefined}
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={!canDownload || isDownloadingPdf}
            onClick={(e) => {
              e.stopPropagation();
              onDownloadPdf?.();
            }}
            aria-label="Download PDF"
            className={styles.downloadBtn}
          >
            {isDownloadingPdf ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}{" "}
            {isDownloadingPdf ? "..." : "PDF"}
          </Button>
        </span>
      </Card.Footer>
    </article>
  );
}
