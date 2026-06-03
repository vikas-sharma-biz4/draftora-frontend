"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./DocumentViewerModal.module.scss";
import { useModalHistory } from "@/hooks/useModalHistory";

interface DocumentViewerModalProps {
  url: string;
  fileName: string;
  fileType: string;
  onClose: () => void;
}

function getViewerUrl(url: string, fileType: string): string {
  const officeTypes = ["docx", "xlsx", "pptx"];
  if (officeTypes.includes(fileType.toLowerCase())) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  }
  return url;
}

function isImageType(fileType: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "webp"].includes(fileType.toLowerCase());
}

export default function DocumentViewerModal({
  url,
  fileName,
  fileType,
  onClose,
}: DocumentViewerModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useModalHistory({ isOpen: true, onClose, modalId: "document-viewer-modal" });

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!mounted) return null;

  const viewerUrl = getViewerUrl(url, fileType);
  const isImage = isImageType(fileType);

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {isImage ? (
            <img src={url} alt={fileName} className={styles.imageViewer} />
          ) : (
            <iframe
              src={viewerUrl}
              title={fileName}
              className={styles.iframeViewer}
              allowFullScreen
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
