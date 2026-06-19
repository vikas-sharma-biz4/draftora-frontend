/**
 * ProposalApprovalBar component
 *
 * Renders the action bar for proposal approval workflow:
 * - Download button
 * - Save Draft button
 * - Approve / Reject buttons with confirmation modal
 * - Approval status badges
 */

"use client";

import React from "react";
import { Download } from "lucide-react";
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
  const { isDownloading, downloadProposal } = useProposalDownload();
  const isPending = !approvalStatus || approvalStatus === "pending";

  return (
    <>
      <div className="proposal-actions-bar">
        {estimateHoursContent}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => downloadProposal(proposalId)}
          disabled={isDownloading}
          className={isDownloading ? "downloading-btn" : ""}
        >
          {isDownloading ? (
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
              <Download size={14} /> Download
            </>
          )}
        </Button>

        {isPending && onSaveDraft && (
          <Button variant="secondary" size="sm" onClick={onSaveDraft} disabled={isDownloading}>
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
              disabled={isDownloading}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onReject}
              loading={isRejecting}
              disabled={isDownloading}
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
