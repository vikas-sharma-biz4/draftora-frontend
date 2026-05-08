"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { useProposals } from "@/hooks/useProposals";
import { useErrorToast } from "@/hooks/useErrorToast";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

const Header = dynamic(() => import("@/components/common/Header"), {
  ssr: false,
  loading: () => <div className="header-skeleton" />,
});

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
  const { proposals, isLoading, error } = useProposals();
  const [search, setSearch] = useState<string>("");

  useErrorToast(error, "Failed to load proposals. Is the backend running?");

  const filtered = proposals.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <Header activeNav="dashboard" />

      <div className="dashboard-content">
        {/* Page header */}
        <div className="dashboard-page-header">
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>
              Your Proposals
            </h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              Manage and track all your AI-generated proposals.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              className="form-input"
              style={{ width: 220 }}
              placeholder="Search by title or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <SkeletonGrid
            className="proposals-grid"
            renderItem={() => <SkeletonCard />}
          />
        ) : filtered.length === 0 ? (
          <div style={{ marginTop: 60 }}>
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
      </div>
    </div>
  );
}
