"use client";

import { useRouter } from "next/navigation";
import { History, Download, Eye } from "lucide-react";
import { useState, useEffect } from "react";

import styles from "./HistoryPage.module.scss";
import { useProposals } from "@/hooks/useProposals";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useProposalDownload } from "@/hooks/useProposalDownload";
import { formatDate } from "@/utils/dateUtils";
import PageLayout from "@/layouts/AppLayout";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import SkeletonGrid from "@/components/common/SkeletonGrid";
import StatusBadge from "@/components/common/StatusBadge";
import HistoryCardSkeleton from "@/components/common/skeletons/HistoryCardSkeleton";

export default function HistoryPage(): JSX.Element {
  const router = useRouter();
  const { proposals: historyItems, isLoading: loading, error } = useProposals({ filter: 'history' });
  const { downloadProposal } = useProposalDownload();
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useErrorToast(error, "Failed to load history");

  const handleDownload = async (id: number): Promise<void> => {
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
  };

  return (
    <PageLayout>
      <PageHeader
        title="History"
        subtitle="View all completed, approved, and rejected proposals."
      />

      {!mounted ? (
        <SkeletonGrid
          className={styles.historyGrid}
          renderItem={() => <HistoryCardSkeleton />}
        />
      ) : loading ? (
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
        <div className={styles.historyGrid}>
          {historyItems.map((item) => (
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
      )}
    </PageLayout>
  );
}
