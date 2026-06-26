"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { deleteDraft, listDrafts } from "@/services/draft.service";
import { deleteProposal } from "@/services/proposal";
import { clientProposalsQueryKey, useClientProposalsQuery } from "@/hooks/useClientProposalsQuery";
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
  /** null = idle, -1 = indeterminate, 0-100 = real percent for the active DOCX download */
  docxProgress: number | null;
  filteredProposals: ProposalListItem[];
  filteredDraftRows: DraftMetadata[];
  handleDownloadProposal: (proposalId: number) => Promise<void>;
  handleDeleteProposal: (proposalId: number) => Promise<void>;
  handleDeleteDraft: (draftId: string) => Promise<void>;
}

/**
 * Loads and filters proposals and drafts for a specific client.
 * Uses useClientProposalsQuery (TanStack Query, client-scoped API call) so ALL
 * proposals for this client are returned — not just the first page of the global list.
 * Drafts are fetched directly as there is no shared draft list store.
 */
export function useClientProposals(clientId: number, clientName: string): UseClientProposalsReturn {
  const queryClient = useQueryClient();
  const { downloadProposal, progress: docxProgress } = useProposalDownload();

  const { proposals: clientProposals, isLoading: isLoadingProposalsQuery } =
    useClientProposalsQuery(clientId);

  const [proposalSearchQuery, setProposalSearchQuery] = useState<string>("");
  const [drafts, setDrafts] = useState<DraftMetadata[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState<boolean>(true);
  const [downloadingProposalId, setDownloadingProposalId] = useState<number | null>(null);

  useEffect(() => {
    setIsLoadingDrafts(true);
    listDrafts()
      .then(setDrafts)
      .catch((err) => logger.error("[useClientProposals] Failed to load drafts:", err))
      .finally(() => setIsLoadingDrafts(false));
  }, [clientId]);

  const clientDrafts = useMemo(() => {
    const proposalIds = new Set(clientProposals.map((p) => p.id));
    const clientNameLower = clientName.toLowerCase();
    const byProposalOrName = drafts.filter(
      (d) =>
        (d.proposalId != null && proposalIds.has(d.proposalId)) ||
        d.clientName.toLowerCase() === clientNameLower
    );
    // Exclude drafts already promoted to a proposal for this client
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

  const handleDeleteProposal = useCallback(
    async (proposalId: number): Promise<void> => {
      await deleteProposal(proposalId);
      await queryClient.invalidateQueries({ queryKey: clientProposalsQueryKey(clientId) });
    },
    [queryClient, clientId]
  );

  const handleDeleteDraft = useCallback(async (draftId: string): Promise<void> => {
    await deleteDraft(draftId);
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  }, []);

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
    isLoadingProposals: isLoadingProposalsQuery || isLoadingDrafts,
    downloadingProposalId,
    docxProgress,
    filteredProposals,
    filteredDraftRows,
    handleDownloadProposal,
    handleDeleteProposal,
    handleDeleteDraft,
  };
}
