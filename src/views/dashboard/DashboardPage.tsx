"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useCallback, useEffect } from "react";

import { useProposals } from "@/hooks/useProposals";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useDebounce } from "@/hooks/useDebounce";
import { ProposalSearch } from "@/components/dashboard/ProposalSearch";
import AppLayout from "@/layouts/AppLayout";
import PageHeader from "@/components/common/PageHeader";

const ProposalCard = dynamic(() => import("@/components/proposal/ProposalCard"), {
  ssr: false,
});

const EmptyState = dynamic(() => import("@/components/common/EmptyState"), {
  ssr: false,
});

const SkeletonCard = dynamic(
  () => import("@/components/common/Skeleton").then((mod) => ({ default: mod.SkeletonCard })),
  { ssr: false }
);

const SkeletonGrid = dynamic(() => import("@/components/common/SkeletonGrid"), { ssr: false });

export default function DashboardPage(): JSX.Element {
  const { proposals, isLoading, error } = useProposals({ autoFetch: true });
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 200);
  const [mounted, setMounted] = useState<boolean>(false);

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

  return (
    <AppLayout>
      <PageHeader
        title="Your Proposals"
        subtitle="Manage and track all your AI-generated proposals."
        action={
          <ProposalSearch
            value={search}
            onChange={handleSearchChange}
          />
        }
      />

      {!mounted ? (
        <SkeletonGrid
          className="proposals-grid"
          renderItem={() => <SkeletonCard />}
        />
      ) : isLoading ? (
        <SkeletonGrid
          className="proposals-grid"
          renderItem={() => <SkeletonCard />}
        />
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
        <div className="proposals-grid">
          {filtered.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
