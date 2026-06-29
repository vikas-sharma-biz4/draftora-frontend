/**
 * ProposalApprovalBar component
 *
 * Renders the action bar for proposal approval workflow:
 * - Download dropdown (DOCX / PDF)
 * - Save Draft button
 * - Approve / Reject buttons with confirmation modal
 * - Approval status badges
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { Download, ChevronDown } from "lucide-react";
import Button from "@/components/common/Button";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useProposalDownload } from "@/hooks/useProposalDownload";

interface ProposalApprovalBarProps {
  proposalId: number;
  approvalStatus?: "pending" | "approved" | "rejected";
  isApproving: boolean;
  isRejecting: boolean;
  onSaveDraft?: () => void;
  onApprove: () => void;
  onReject: () => void;
  onExecuteAction: (actionType: "approve" | "reject", signal: AbortSignal) => Promise<void>;
  confirmModal: { isOpen: boolean; message: string; actionType: "approve" | "reject" | null };
  onConfirmModalClose: () => void;
  estimateHoursContent?: React.ReactNode;
}

export default function ProposalApprovalBar({
  proposalId,
  approvalStatus,
  isApproving,
  isRejecting,
  onSaveDraft,
  onApprove,
  onReject,
  onExecuteAction,
  confirmModal,
  onConfirmModalClose,
  estimateHoursContent,
}: ProposalApprovalBarProps): JSX.Element {
  const { isDownloading, isPdfDownloading, downloadProposal, downloadProposalPdf } =
    useProposalDownload();
  const isPending = !approvalStatus || approvalStatus === "pending";
  const isAnyDownloading = isDownloading || isPdfDownloading;

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDownloadOpen(false);
      }
    }
    if (isDownloadOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDownloadOpen]);

  function handleDocx(): void {
    setIsDownloadOpen(false);
    downloadProposal(proposalId);
  }

  function handlePdf(): void {
    setIsDownloadOpen(false);
    downloadProposalPdf(proposalId);
  }

  return (
    <>
      <div className="proposal-actions-bar">
        {estimateHoursContent}

        {/* Download dropdown */}
        <div className="download-dropdown" ref={dropdownRef}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDownloadOpen((o) => !o)}
            disabled={isAnyDownloading}
            className={`download-dropdown-trigger${isAnyDownloading ? " downloading-btn" : ""}`}
          >
            {isAnyDownloading ? (
              <div className="flex items-center gap-2">
                <span className="downloading-text">Downloading</span>
                <span className="downloading-dots">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </span>
              </div>
            ) : (
              <>
                <Download size={14} />
                Download
                <ChevronDown
                  size={13}
                  className={`download-chevron${isDownloadOpen ? " open" : ""}`}
                />
              </>
            )}
          </Button>

          {isDownloadOpen && (
            <div className="download-dropdown-menu">
              <button className="download-dropdown-item" onClick={handleDocx}>
                <Download size={13} />
                Download DOCX
              </button>
              <button className="download-dropdown-item" onClick={handlePdf}>
                <Download size={13} />
                Download PDF
              </button>
            </div>
          )}
        </div>

        {isPending && onSaveDraft && (
          <Button variant="secondary" size="sm" onClick={onSaveDraft} disabled={isAnyDownloading}>
            Save Draft
          </Button>
        )}

        {isPending && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={onApprove}
              loading={isApproving}
              disabled={isAnyDownloading}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onReject}
              loading={isRejecting}
              disabled={isAnyDownloading}
            >
              Reject
            </Button>
          </>
        )}

        {approvalStatus === "approved" && <span className="badge badge-success">Approved</span>}
        {approvalStatus === "rejected" && <span className="badge badge-danger">Rejected</span>}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={async (signal: AbortSignal) => {
          const actionType = confirmModal.actionType;
          if (actionType) {
            try {
              await onExecuteAction(actionType, signal);
              onConfirmModalClose();
            } catch (error) {
              // Keep modal open on error - user can retry or cancel
            }
          } else {
            onConfirmModalClose();
          }
        }}
        onCancel={onConfirmModalClose}
      />
    </>
  );
}
