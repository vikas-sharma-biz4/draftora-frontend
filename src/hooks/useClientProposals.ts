"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

import { listDrafts } from "@/services/draft.service";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";
import { useProposalDownload } from "@/hooks/useProposalDownload";
import { logger } from "@/utils/logger";
import type { DraftMetadata } from "@/interfaces/draftInterfaces";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

interface UseClientProposalsReturn {
  proposalSearchQuery: string;
  setProposalSearchQuery: (q: string) => void;
  clientProposals: ProposalListItem[];
  clientDrafts: DraftMetadata[];
  isLoadingProposals: boolean;
  downloadingProposalId: number | null;
  filteredProposals: ProposalListItem[];
  filteredDraftRows: DraftMetadata[];
  handleDownloadProposal: (proposalId: number) => Promise<void>;
}

/**
 * Loads and filters proposals and drafts for a specific client.
 * Uses useProposalStore for proposals (cache-aware, avoids redundant API calls
 * when navigating from Dashboard which already fetched all proposals).
 * Drafts are fetched directly as there is no shared draft list store.
 */
export function useClientProposals(clientId: number, clientName: string): UseClientProposalsReturn {
  const { downloadProposal } = useProposalDownload();

  const allProposals = useProposalStore((s) => s.proposals);
  const isStoreLoading = useProposalStore((s) => s.isLoading);

  const [proposalSearchQuery, setProposalSearchQuery] = useState<string>("");
  const [drafts, setDrafts] = useState<DraftMetadata[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState<boolean>(true);
  const [isLoadingProposalsLocal, setIsLoadingProposalsLocal] = useState<boolean>(true);
  const [downloadingProposalId, setDownloadingProposalId] = useState<number | null>(null);

  // Reuse the proposal store cache; only fetch if stale
  useEffect(() => {
    const { isCacheValid, fetchProposals } = useProposalStore.getState();
    if (isCacheValid()) {
      setIsLoadingProposalsLocal(false);
      return;
    }
    fetchProposals()
      .catch((err) => logger.error("[useClientProposals] Failed to fetch proposals:", err))
      .finally(() => setIsLoadingProposalsLocal(false));
  }, [clientId]);

  useEffect(() => {
    setIsLoadingDrafts(true);
    listDrafts()
      .then(setDrafts)
      .catch((err) => logger.error("[useClientProposals] Failed to load drafts:", err))
      .finally(() => setIsLoadingDrafts(false));
  }, [clientId]);

  const clientProposals = useMemo(
    () => allProposals.filter((p) => p.clientId === clientId),
    [allProposals, clientId]
  );

  const clientDrafts = useMemo(() => {
    const proposalIds = new Set(clientProposals.map((p) => p.id));
    const clientNameLower = clientName.toLowerCase();
    const byProposalOrName = drafts.filter(
      (d) =>
        (d.proposalId != null && proposalIds.has(d.proposalId)) ||
        d.clientName.toLowerCase() === clientNameLower
    );
    return byProposalOrName.filter((d) => d.proposalId == null || !proposalIds.has(d.proposalId));
  }, [drafts, clientProposals, clientName]);

  const handleDownloadProposal = useCallback(
    async (proposalId: number): Promise<void> => {
      setDownloadingProposalId(proposalId);
      try {
        await downloadProposal(proposalId);
      } finally {
        setDownloadingProposalId(null);
      }
    },
    [downloadProposal]
  );

  const filteredProposals = useMemo(() => {
    if (!proposalSearchQuery) return clientProposals;
    const q = proposalSearchQuery.toLowerCase();
    return clientProposals.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.version != null && String(p.version).includes(q))
    );
  }, [clientProposals, proposalSearchQuery]);

  const filteredDraftRows = useMemo(() => {
    if (!proposalSearchQuery) return clientDrafts;
    const q = proposalSearchQuery.toLowerCase();
    return clientDrafts.filter(
      (d) => d.title.toLowerCase().includes(q) || d.clientName.toLowerCase().includes(q)
    );
  }, [clientDrafts, proposalSearchQuery]);

  return {
    proposalSearchQuery,
    setProposalSearchQuery,
    clientProposals,
    clientDrafts,
    isLoadingProposals: isLoadingProposalsLocal || isStoreLoading || isLoadingDrafts,
    downloadingProposalId,
    filteredProposals,
    filteredDraftRows,
    handleDownloadProposal,
  };
}
