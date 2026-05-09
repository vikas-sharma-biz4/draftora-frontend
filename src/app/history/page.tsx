"use client";

import { useRouter } from "next/navigation";
import { History, Download, Eye } from "lucide-react";
import { toast } from "sonner";

import styles from "./page.module.scss";
import { useProposals } from "@/hooks/useProposals";
import { useErrorToast } from "@/hooks/useErrorToast";
import { getDownloadUrl } from "@/services/proposalApi";
import { formatDate } from "@/utils/dateUtils";
import PageLayout from "@/components/common/PageLayout";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import SkeletonGrid from "@/components/common/SkeletonGrid";
import StatusBadge from "@/components/common/StatusBadge";
import HistoryCardSkeleton from "@/components/common/skeletons/HistoryCardSkeleton";

export default function HistoryPage(): JSX.Element {
  const router = useRouter();
  const { proposals: historyItems, isLoading: loading, error } = useProposals({ filter: 'history' });

  useErrorToast(error, "Failed to load history");

  return (
    <PageLayout>
      <PageHeader
        title="History"
        subtitle="View all completed, approved, and rejected proposals."
      />

      {loading ? (
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
                <a
                  href={getDownloadUrl(item.id)}
                  className="btn btn-secondary btn-sm"
                  download
                  onClick={() => toast.success("Downloading proposal...")}
                >
                  <Download size={14} /> Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
