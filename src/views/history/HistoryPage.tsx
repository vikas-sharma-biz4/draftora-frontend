"use client";

import { useRouter } from "next/navigation";
import { History, Download, Eye, Loader2, Search, X, Calendar, ChevronDown } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

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

type StatusFilter = "all" | "approved" | "rejected";
type DateFilterType = "all" | "today" | "custom";

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

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>("all");
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setShowDateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort proposals
  const filteredAndSortedProposals = useMemo(() => {
    let filtered = [...historyItems];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.clientName.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.approvalStatus === statusFilter);
    }

    // Apply date filter
    if (dateFilterType !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilterType === "today") {
        filtered = filtered.filter((item) => {
          const itemDate = new Date(item.createdAt);
          itemDate.setHours(0, 0, 0, 0);
          return itemDate.getTime() === today.getTime();
        });
      } else if (dateFilterType === "custom" && customDateRange) {
        const startDate = new Date(customDateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(customDateRange.end);
        endDate.setHours(23, 59, 59, 999);

        filtered = filtered.filter((item) => {
          const itemDate = new Date(item.createdAt);
          return itemDate.getTime() >= startDate.getTime() && itemDate.getTime() <= endDate.getTime();
        });
      }
    }

    // Default sort by latest
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return filtered;
  }, [historyItems, searchQuery, statusFilter, dateFilterType, customDateRange]);

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
        subtitle="All proposals — search and filter below."
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
          {/* Search, Filter, and Sort Controls */}
          <div className={styles.controlsContainer}>
            {/* Filter Pills and Date Filter Group */}
            <div className={styles.filterSortGroup}>
              {/* Filter Pills */}
              <div className={styles.filterGroup}>
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`${styles.filterPill} ${statusFilter === "all" ? styles.active : ""}`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter("approved")}
                  className={`${styles.filterPill} ${statusFilter === "approved" ? styles.active : ""}`}
                >
                  Approved
                </button>
                <button
                  onClick={() => setStatusFilter("rejected")}
                  className={`${styles.filterPill} ${statusFilter === "rejected" ? styles.active : ""}`}
                >
                  Rejected
                </button>
              </div>

              {/* Date Filter Dropdown */}
              <div className={styles.dateFilterWrapper} ref={dateDropdownRef}>
                <button
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
                  className={`${styles.dateFilterButton} ${dateFilterType !== "all" ? styles.active : ""}`}
                >
                  <Calendar size={16} />
                  <span>
                    {dateFilterType === "all" && "All Time"}
                    {dateFilterType === "today" && "Latest Today"}
                    {dateFilterType === "custom" && customDateRange && "Custom Range"}
                  </span>
                  <ChevronDown size={14} className={showDateDropdown ? styles.rotate : ""} />
                </button>

                {showDateDropdown && (
                  <div className={styles.dateDropdown}>
                    <button
                      onClick={() => {
                        setDateFilterType("all");
                        setCustomDateRange(null);
                        setShowDateDropdown(false);
                      }}
                      className={`${styles.dateDropdownItem} ${dateFilterType === "all" ? styles.active : ""}`}
                    >
                      All Time
                    </button>
                    <button
                      onClick={() => {
                        setDateFilterType("today");
                        setCustomDateRange(null);
                        setShowDateDropdown(false);
                      }}
                      className={`${styles.dateDropdownItem} ${dateFilterType === "today" ? styles.active : ""}`}
                    >
                      Latest Today
                    </button>
                    <button
                      onClick={() => {
                        setDateFilterType("custom");
                      }}
                      className={`${styles.dateDropdownItem} ${dateFilterType === "custom" ? styles.active : ""}`}
                    >
                      Custom Range
                    </button>
                    {dateFilterType === "custom" && (
                      <div className={styles.customDateRange}>
                        <div className={styles.dateInputWrapper}>
                          <label>From:</label>
                          <input
                            type="date"
                            value={customDateRange?.start || ""}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setCustomDateRange(prev => ({ start: e.target.value, end: prev?.end || "" }))}
                            className={styles.dateInput}
                          />
                        </div>
                        <div className={styles.dateInputWrapper}>
                          <label>To:</label>
                          <input
                            type="date"
                            value={customDateRange?.end || ""}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => {
                              const newEnd = e.target.value;
                              setCustomDateRange(prev => ({ start: prev?.start || "", end: newEnd }));
                              // Auto-close dropdown when both dates are selected
                              if (customDateRange?.start && newEnd) {
                                setShowDateDropdown(false);
                              }
                            }}
                            className={styles.dateInput}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div className={styles.searchWrapper}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search proposals or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className={styles.clearButton}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          {filteredAndSortedProposals.length === 0 ? (
            <EmptyState
              icon={<Search size={48} />}
              title="No Results Found"
              subtitle="Try adjusting your search or filters."
            />
          ) : (
            <>
              <div className={styles.historyGrid}>
                {filteredAndSortedProposals.map((item, index) => (
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
                        className={styles.actionButton}
                        onClick={() => router.push(`/proposal/${item.id}?from=history`)}
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={() => void handleDownload(item.id)}
                        disabled={downloadingIds.has(item.id)}
                      >
                        {downloadingIds.has(item.id) ? (
                          <div className="flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
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
              {!hasMore && filteredAndSortedProposals.length > 0 && (
                <div className={styles.endOfList}>
                  <p>You've reached the end of your proposal history</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PageLayout>
  );
}
