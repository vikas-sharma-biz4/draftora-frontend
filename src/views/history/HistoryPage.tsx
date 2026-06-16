"use client";

import { useRouter } from "next/navigation";
import { History, Download, Eye, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";

import styles from "./HistoryPage.module.scss";
import { PROPOSAL_TEMPLATES } from "@/constants";
import { useInfiniteProposalHistory } from "@/hooks/useInfiniteProposalHistory";
import { useDebounce } from "@/hooks/useDebounce";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useProposalDownload } from "@/hooks/useProposalDownload";
import { formatDate } from "@/utils/dateUtils";
import { logger } from "@/utils/logger";
import PageLayout from "@/layouts/AppLayout";
import Button from "@/components/common/Button";
import EmptyState from "@/components/common/EmptyState";
import PageHeader from "@/components/common/PageHeader";
import SearchBar from "@/components/common/SearchBar/SearchBar";
import SkeletonGrid from "@/components/common/SkeletonGrid";
import HistoryCardSkeleton from "@/components/common/Skeletons/HistoryCardSkeleton";
import StatusBadge from "@/components/common/StatusBadge";

type StatusFilter = "all" | "approved" | "rejected";

const STATUS_FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

export default function HistoryPage(): JSX.Element {
  const router = useRouter();
  const {
    proposals: historyItems,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    refetch,
    observerRef,
  } = useInfiniteProposalHistory();
  const { downloadProposal } = useProposalDownload();
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (!isLoading && historyItems.length > 0) {
      logger.info(`[HistoryPage] Data loaded - ${historyItems.length} history items found`, {
        items: historyItems.slice(0, 5).map((item) => ({
          id: item.id,
          title: item.title,
          approvalStatus: item.approvalStatus,
        })),
      });
    }
  }, [isLoading, historyItems]);

  useErrorToast(error, "Failed to load history");

  const handleDownload = useCallback(
    async (id: number): Promise<void> => {
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
    },
    [downloadProposal]
  );

  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      if (statusFilter !== "all" && item.approvalStatus !== statusFilter) return false;
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.clientName.toLowerCase().includes(q) ||
        String(item.id).includes(q) ||
        (item.version != null && String(item.version).includes(q))
      );
    });
  }, [historyItems, debouncedSearch, statusFilter]);

  const hasActiveFilter = debouncedSearch || statusFilter !== "all";

  return (
    <PageLayout>
      <PageHeader
        title="History"
        subtitle="View all completed, approved, and rejected proposals."
      />

      {/* Toolbar: search + status filter */}
      {(!isLoading || historyItems.length > 0) && (
        <div className={styles.toolbar}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by title, client, or ID..."
            className={styles.searchBar}
          />
          <div className={styles.filterGroup}>
            {STATUS_FILTER_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`${styles.filterBtn} ${statusFilter === value ? styles.filterBtnActive : ""}`}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <SkeletonGrid className={styles.historyGrid} renderItem={() => <HistoryCardSkeleton />} />
      ) : historyItems.length === 0 ? (
        <EmptyState
          icon={<History size={48} />}
          title="No History Yet"
          subtitle="Approved and rejected proposals will appear here."
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<History size={48} />}
          title="No Matching Proposals"
          subtitle={
            hasActiveFilter
              ? "Try adjusting your search or filter."
              : "No proposals match your criteria."
          }
        />
      ) : (
        <>
          <div className={styles.historyGrid}>
            {filteredItems.map((item) => {
              const versionLabel = item.version != null ? `v${item.version}` : null;
              const { templateId, templateType } = item;
              const templateName = (() => {
                if (templateId) {
                  return PROPOSAL_TEMPLATES.find((t) => t.id === templateId)?.name ?? "Template";
                }
                if (templateType === "scratch" || (!templateId && !templateType))
                  return "From Scratch";
                if (templateType) {
                  return (
                    PROPOSAL_TEMPLATES.find((t) => t.templateType === templateType)?.name ?? null
                  );
                }
                return null;
              })();
              return (
                <div key={item.id} className={styles.historyCard} data-testid="proposal-card">
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>{item.title}</div>
                    <div className={styles.cardHeaderRight}>
                      {versionLabel && <span className={styles.versionBadge}>{versionLabel}</span>}
                      <StatusBadge status={item.approvalStatus} />
                    </div>
                  </div>
                  <div className={styles.cardClient}>
                    <span className={styles.clientLabel}>Client:</span>
                    <span className={styles.clientName}>{item.clientName}</span>
                  </div>
                  <div className={styles.cardDate}>{formatDate(item.createdAt)}</div>
                  {templateName && <div className={styles.cardTemplate}>{templateName}</div>}
                  <div className={styles.cardActions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(`/proposal/${item.id}?from=history`)}
                    >
                      <Eye size={14} /> View
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={downloadingIds.has(item.id)}
                      onClick={() => handleDownload(item.id)}
                    >
                      {downloadingIds.has(item.id) ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}{" "}
                      {downloadingIds.has(item.id) ? "Download..." : "Download"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Infinite scroll trigger — only when not filtering */}
          {!hasActiveFilter && hasMore && (
            <div ref={observerRef} className={styles.loadMoreTrigger}>
              {isLoadingMore && (
                <div className={styles.loadingMore}>
                  <Loader2 size={24} className="animate-spin" />
                  <span>Loading more proposals...</span>
                </div>
              )}
            </div>
          )}

          {!hasActiveFilter && !hasMore && historyItems.length > 0 && (
            <div className={styles.endOfList}>
              <p>You&apos;ve reached the end of your proposal history</p>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
