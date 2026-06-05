"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

import { useProposals } from "@/hooks/useProposals";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useDebounce } from "@/hooks/useDebounce";
import { ProposalSearch } from "@/components/dashboard/ProposalSearch";
import AppLayout from "@/layouts/AppLayout";
import PageHeader from "@/components/common/PageHeader";

const ProposalCard = dynamic(() => import("@/components/proposal/ProposalCard"), {
  ssr: false,
});

import EmptyState from "@/components/common/EmptyState";

const SkeletonCard = dynamic(
  () => import("@/components/common/Skeleton").then((mod) => ({ default: mod.SkeletonCard })),
  { ssr: false }
);

const SkeletonGrid = dynamic(() => import("@/components/common/SkeletonGrid"), { ssr: false });

export default function DashboardPage(): JSX.Element {
  const { proposals, isLoading, isLoadingMore, isInitialized, error, hasMore, fetchMore } =
    useProposals();
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 200);
  const [mounted, setMounted] = useState<boolean>(false);

  const loadingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useErrorToast(error, "Failed to load proposals. Is the backend running?");

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const filtered = useMemo(
    () =>
      proposals.filter(
        (p) =>
          p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          p.clientName.toLowerCase().includes(debouncedSearch.toLowerCase())
      ),
    [proposals, debouncedSearch]
  );

  // Infinite scroll sentinel callback — fires when the bottom of the list enters the viewport
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isLoadingMore) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
            loadingRef.current = true;
            fetchMore().finally(() => {
              loadingRef.current = false;
            });
          }
        },
        { rootMargin: "200px" }
      );

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isLoading, isLoadingMore, hasMore, fetchMore]
  );

  // Disconnect observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const hasActiveSearch = debouncedSearch.length > 0;

  return (
    <AppLayout>
      <PageHeader
        title="Your Proposals"
        subtitle="Manage and track all your AI-generated proposals."
        action={
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <ProposalSearch value={search} onChange={handleSearchChange} />
            <Link href="/" className="btn btn-primary btn-sm">
              New Proposal
            </Link>
          </div>
        }
      />

      {!mounted || (isLoading && !isInitialized) ? (
        <SkeletonGrid className="proposals-grid" renderItem={() => <SkeletonCard />} />
      ) : filtered.length === 0 ? (
        <div className="empty-state-wrapper">
          {proposals.length === 0 ? (
            <EmptyState
              title="No proposals yet"
              subtitle="Create your first AI-generated proposal to get started."
              ctaLabel="Create Proposal"
              ctaHref="/"
            />
          ) : (
            <EmptyState
              title="No results found"
              subtitle={`No proposals match "${search}".`}
              ctaLabel="Clear Search"
              ctaHref="/dashboard"
            />
          )}
        </div>
      ) : (
        <>
          <div className="proposals-grid">
            {filtered.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>

          {/* Infinite scroll trigger — only when not filtering */}
          {!hasActiveSearch && hasMore && (
            <div ref={sentinelRef} style={{ height: 1 }}>
              {isLoadingMore && (
                <div className="flex-center gap-8" style={{ padding: "24px 0" }}>
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-muted">Loading more proposals…</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
