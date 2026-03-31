"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import Header from "@/components/common/Header";
import ProposalCard from "@/components/proposal/ProposalCard";
import EmptyState from "@/components/shared/EmptyState";
import { SkeletonCard } from "@/components/shared/Skeleton";
import { listProposals } from "@/api/proposalApi";
import type { ProposalListItem } from "@/types/proposal.types";

export default function DashboardPage(): JSX.Element {
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    listProposals()
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setProposals(sorted);
      })
      .catch(() => {
        toast.error("Failed to load proposals. Is the backend running?");
      })
      .finally(() => setIsLoading(false));
  }, []);

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
          <div className="proposals-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
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
