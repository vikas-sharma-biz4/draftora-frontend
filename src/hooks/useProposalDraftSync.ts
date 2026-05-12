/**
 * useProposalDraftSync — thin wrapper around useDraftPersistence
 *
 * Kept as a separate hook for backward compatibility with components
 * that import it directly. Delegates all logic to useDraftPersistence.
 */

"use client";

import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import type { ProposalData } from "@/interfaces/proposalInterfaces";

interface UseProposalDraftSyncOptions {
  proposalId: number;
  proposal: ProposalData | null;
  activeSection: string;
  enabled?: boolean;
}

export function useProposalDraftSync(options: UseProposalDraftSyncOptions): void {
  const { proposalId, proposal, activeSection, enabled = true } = options;

  useDraftPersistence({
    enabled: enabled && proposal?.status === "completed",
    proposalId,
    proposal,
    activeSection,
    lastLocation: "web_view",
    stage: "generated",
  });
}
