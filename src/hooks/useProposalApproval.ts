/**
 * Hook for managing proposal approval, rejection, and download actions
 *
 * Handles:
 * - Approve/reject workflow with confirmation
 * - Updating approval status via API
 * - Removing associated drafts
 * - Download functionality with streaming fetch
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProposalDownload } from '@/hooks/useProposalDownload';
import { updateApprovalStatus } from '@/services/proposal.service';
import { deleteDraft, getDraftByProposalId } from '@/services/draft.service';
import { toast } from '@/utils/toast';
import { MESSAGES } from '@/constants/messages';
import { logger } from '@/utils/logger';

interface UseProposalApprovalOptions {
  proposalId: number;
  onApprovalSuccess?: (status: 'approved' | 'rejected') => void;
  onCacheInvalidate?: () => void;
}

interface UseProposalApprovalReturn {
  isApproving: boolean;
  isRejecting: boolean;
  isDownloading: boolean;
  handleApprove: () => Promise<void>;
  handleReject: () => Promise<void>;
  handleDownload: () => Promise<void>;
}

export function useProposalApproval(options: UseProposalApprovalOptions): UseProposalApprovalReturn {
  const { proposalId, onApprovalSuccess, onCacheInvalidate } = options;
  const router = useRouter();

  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const { isDownloading, downloadProposal } = useProposalDownload();

  const executeApprovalAction = useCallback(async (actionType: 'approve' | 'reject'): Promise<void> => {
    const status = actionType === 'approve' ? 'approved' : 'rejected';
    const setLoading = actionType === 'approve' ? setIsApproving : setIsRejecting;
    const successMessage = actionType === 'approve'
      ? MESSAGES.PROPOSAL_APPROVED
      : MESSAGES.PROPOSAL_REJECTED;

    setLoading(true);
    try {
      // Update approval status via API
      await updateApprovalStatus(proposalId, status);

      // Remove from drafts via API
      try {
        const proposalDraft = await getDraftByProposalId(proposalId);
        if (proposalDraft) {
          await deleteDraft(proposalDraft.id);
        }
      } catch (draftError) {
        logger.error('[useProposalApproval] Failed to remove draft:', draftError);
      }

      // Notify parent component
      onApprovalSuccess?.(status);

      // Invalidate cache to force refresh on history page
      onCacheInvalidate?.();

      toast.success(successMessage);

      // Small delay to ensure toast is shown before redirect
      await new Promise(resolve => setTimeout(resolve, 500));
      router.push('/history');
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : actionType === 'approve'
        ? MESSAGES.PROPOSAL_APPROVE_FAILED
        : MESSAGES.PROPOSAL_REJECT_FAILED;
      logger.error(`[useProposalApproval] Failed to ${actionType}:`, error);
      toast.error(message);
      throw error; // Re-throw to keep modal open on error
    } finally {
      setLoading(false);
    }
  }, [proposalId, router, onApprovalSuccess, onCacheInvalidate]);

  const handleApprove = useCallback(async (): Promise<void> => {
    await executeApprovalAction('approve');
  }, [executeApprovalAction]);

  const handleReject = useCallback(async (): Promise<void> => {
    await executeApprovalAction('reject');
  }, [executeApprovalAction]);

  const handleDownload = useCallback(async (): Promise<void> => {
    await downloadProposal(proposalId);
  }, [proposalId, downloadProposal]);

  return {
    isApproving,
    isRejecting,
    isDownloading,
    handleApprove,
    handleReject,
    handleDownload,
  };
}
