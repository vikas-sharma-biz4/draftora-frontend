"use client";

import { useRouter } from "next/navigation";
import { History, Download, Eye, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

import styles from "./HistoryPage.module.scss";
import { useInfiniteProposalHistory } from "@/hooks/useInfiniteProposalHistory";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useProposalDownload } from "@/hooks/useProposalDownload";
import { formatDate } from "@/utils/dateUtils";
import { logger } from "@/utils/logger";
import PageLayout from "@/layouts/AppLayout";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import SkeletonGrid from "@/components/common/SkeletonGrid";
import StatusBadge from "@/components/common/StatusBadge";
import HistoryCardSkeleton from "@/components/common/skeletons/HistoryCardSkeleton";

export default function HistoryPage(): JSX.Element {
  const router = useRouter();
  const { 
    proposals: historyItems, 
    isLoading, 
    isLoadingMore,
    error, 
    hasMore,
    refetch,
    observerRef 
  } = useInfiniteProposalHistory();
  const { downloadProposal } = useProposalDownload();
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());

  // Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (!document.hidden) {
        void refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  useEffect(() => {
    if (!isLoading && historyItems.length > 0) {
      logger.info(`[HistoryPage] Data loaded - ${historyItems.length} history items found`, {
        items: historyItems.slice(0, 5).map(item => ({
          id: item.id,
          title: item.title,
          approvalStatus: item.approvalStatus,
        })),
      });
    }
  }, [isLoading, historyItems]);

  useErrorToast(error, "Failed to load history");

  const handleDownload = useCallback(async (id: number): Promise<void> => {
    setDownloadingIds((prev) => new Set(prev).add(id));
    try {
      await downloadProposal(id);
    } finally {
      setDownloadingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, [downloadProposal]);

  return (
    <PageLayout>
      <PageHeader
        title="History"
        subtitle="View all completed, approved, and rejected proposals."
      />

      {isLoading ? (
        <SkeletonGrid
          className={styles.historyGrid}
          renderItem={() => <HistoryCardSkeleton />}
        />
      ) : historyItems.length === 0 ? (
        <EmptyState
          icon={<History size={48} />}
          title="No History Yet"
          subtitle="Approved and rejected proposals will appear here."
        />
      ) : (
        <>
          <div className={styles.historyGrid}>
            {historyItems.map((item, index) => (
              <div key={item.id} className={styles.historyCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>{item.title}</div>
                  <StatusBadge status={item.approvalStatus} />
                </div>
                <div className={styles.cardClient}>
                  <span className={styles.clientLabel}>Client:</span>
                  <span className={styles.clientName}>{item.clientName}</span>
                </div>
                <div className={styles.cardDate}>
                  {formatDate(item.createdAt)}
                </div>
                <div className={styles.cardActions}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => router.push(`/proposal/${item.id}?from=history`)}
                  >
                    <Eye size={14} /> View
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDownload(item.id)}
                    disabled={downloadingIds.has(item.id)}
                  >
                    {downloadingIds.has(item.id) ? (
                      <div className="flex items-center gap-2">
                        <span className="spinner spinner-white" style={{ width: 14, height: 14 }} />
                        Downloading...
                      </div>
                    ) : (
                      <>
                        <Download size={14} /> Download
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Infinite scroll trigger element */}
          {hasMore && (
            <div ref={observerRef} className={styles.loadMoreTrigger}>
              {isLoadingMore && (
                <div className={styles.loadingMore}>
                  <Loader2 size={24} className="animate-spin" />
                  <span>Loading more proposals...</span>
                </div>
              )}
            </div>
          )}

          {/* End of list indicator */}
          {!hasMore && historyItems.length > 0 && (
            <div className={styles.endOfList}>
              <p>You've reached the end of your proposal history</p>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
