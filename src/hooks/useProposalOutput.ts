/**
 * Hook for managing proposal fetching and polling
 *
 * Handles:
 * - Fetching proposal data from backend
 * - Polling for status updates during generation
 * - Redirecting to appropriate pages based on status
 * - Setting active section when proposal loads
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getProposal } from "@/services/proposal";
import type { ProposalData } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";

interface UseProposalOutputOptions {
  proposalId: number;
  onProposalLoaded?: (proposal: ProposalData) => void;
}

interface UseProposalOutputReturn {
  proposal: ProposalData | null;
  isLoading: boolean;
  errorMessage: string;
  activeSection: string;
  setActiveSection: (section: string) => void;
  refetch: () => Promise<void>;
}

export function useProposalOutput(options: UseProposalOutputOptions): UseProposalOutputReturn {
  const { proposalId, onProposalLoaded } = options;
  const router = useRouter();

  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeSection, setActiveSection] = useState<string>("");

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProposal = useCallback(async (): Promise<void> => {
    try {
      const data = await getProposal(proposalId);
      setProposal(data);

      if (data.status === "completed") {
        setIsLoading(false);
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

        const sections = data.selectedSections ?? [];
        if (sections.length > 0 && !activeSection) {
          setActiveSection(sections[0]);
        }

        onProposalLoaded?.(data);
        return;
      }

      if (data.status === "failed") {
        setIsLoading(false);
        setErrorMessage("Proposal generation failed. Please go back and try again.");
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        return;
      }

      // If still generating, redirect to generating page
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      router.replace(`/generating/${proposalId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load proposal.";
      logger.error("[useProposalOutput] Failed to fetch proposal:", err);
      setErrorMessage(message);
      setIsLoading(false);
    }
  }, [proposalId, router, activeSection, onProposalLoaded]);

  useEffect(() => {
    fetchProposal();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchProposal]);

  return {
    proposal,
    isLoading,
    errorMessage,
    activeSection,
    setActiveSection,
    refetch: fetchProposal,
  };
}
