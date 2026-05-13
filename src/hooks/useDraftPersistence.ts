/**
 * useDraftPersistence — unified hook for draft save-on-unmount + beforeunload
 *
 * Replaces the triplicated draft-save logic previously found in:
 *   - useDraftAutoSave.ts
 *   - useProposalDraftSync.ts
 *   - useProposalPageData.ts (inline effect)
 *
 * Handles:
 *   - Async save via saveDraft / updateDraft on unmount & visibilitychange
 *   - Synchronous localStorage fallback on beforeunload
 *   - Draft lookup via getDraftByProposalId (no N+1 listDrafts call)
 *   - UI state capture (scroll position, active section)
 */

"use client";

import { useEffect, useRef } from "react";

import {
  saveDraft as saveDraftApi,
  updateDraft as updateDraftApi,
  getDraftByProposalId,
} from "@/services/draft.service";
import type {
  DraftLocation,
  DraftStage,
  DraftUIState,
  SaveDraftPayload,
} from "@/interfaces/draftInterfaces";
import type { ProposalData, WizardStep } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";
import { DRAFTS_AUTOSAVE_FALLBACK_KEY } from "@/constants/storageKeys";

// ─── Options ────────────────────────────────────────────────────────────────

export interface UseDraftPersistenceOptions {
  /** Whether the hook is active */
  enabled: boolean;
  /** Proposal ID — used to look up existing draft */
  proposalId: number | null;
  /** Full proposal data to persist */
  proposal: ProposalData | null;
  /** Current active section key for UI state restoration */
  activeSection: string;
  /** Where the user currently is in the app */
  lastLocation: DraftLocation;
  /** Current draft stage */
  stage: DraftStage;
  /** Wizard step to record */
  wizardStep?: WizardStep;
  /** If true, skip save for approved/rejected proposals (default: true) */
  skipIfApproved?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function captureUIState(activeSection: string): DraftUIState {
  return {
    scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
    activeSection: activeSection || null,
    expandedSections: [],
    lastVisibleSection: null,
  };
}

function saveToFallbackStore(draftItem: Record<string, unknown>): void {
  try {
    const raw = localStorage.getItem(DRAFTS_AUTOSAVE_FALLBACK_KEY);
    const existing: Array<{ id: string }> = raw ? JSON.parse(raw) : [];
    const idx = existing.findIndex((d) => d.id === draftItem.id);
    if (idx >= 0) {
      existing[idx] = draftItem as typeof existing[0];
    } else {
      existing.unshift(draftItem as typeof existing[0]);
    }
    localStorage.setItem(DRAFTS_AUTOSAVE_FALLBACK_KEY, JSON.stringify(existing));
  } catch (error) {
    logger.error("[useDraftPersistence] fallback save failed:", error);
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDraftPersistence(options: UseDraftPersistenceOptions): void {
  const {
    enabled,
    proposalId,
    proposal,
    activeSection,
    lastLocation,
    stage,
    wizardStep = 5 as WizardStep,
    skipIfApproved = true,
  } = options;

  const draftIdRef = useRef<string | null>(null);
  const proposalRef = useRef<ProposalData | null>(proposal);
  const activeSectionRef = useRef<string>(activeSection);
  const wizardStepRef = useRef<WizardStep>(wizardStep);
  const skipIfApprovedRef = useRef<boolean>(skipIfApproved);

  useEffect(() => { proposalRef.current = proposal; }, [proposal]);
  useEffect(() => { activeSectionRef.current = activeSection; }, [activeSection]);
  useEffect(() => { wizardStepRef.current = wizardStep; }, [wizardStep]);
  useEffect(() => { skipIfApprovedRef.current = skipIfApproved; }, [skipIfApproved]);

  useEffect(() => {
    if (!enabled || !proposalId || !proposalRef.current) return;

    let isMounted = true;

    // ── Async save (used on unmount & visibilitychange) ──────────────────────

    async function saveToDrafts(): Promise<void> {
      if (!isMounted) return;
      const currentProposal = proposalRef.current;
      if (!currentProposal || !currentProposal.status || currentProposal.status !== "completed") return;

      if (skipIfApprovedRef.current && (currentProposal.approvalStatus === "approved" || currentProposal.approvalStatus === "rejected")) {
        return;
      }

      try {
        const uiState = captureUIState(activeSectionRef.current);

        const draftPayload: SaveDraftPayload = {
          proposalId,
          title: currentProposal.title || "Untitled Proposal",
          clientName: currentProposal.clientName || "",
          status: "draft",
          lastLocation,
          stage,
          wizardState: {
            proposalData: { ...currentProposal, files: [] },
            currentStep: wizardStepRef.current,
            maxStepReached: wizardStepRef.current,
            completedSteps: [1, 2, 3, 4, 5],
          },
          generatedContent: currentProposal.sections || {},
          uiState,
        };

        // Look up existing draft by proposalId (targeted query, no N+1)
        let draftId = draftIdRef.current;
        if (!draftId && proposalId != null) {
          const existing = await getDraftByProposalId(proposalId);
          if (existing) {
            draftId = existing.id;
            if (isMounted) draftIdRef.current = draftId;
          }
        }

        if (draftId) {
          await updateDraftApi(draftId, draftPayload);
        } else {
          const saved = await saveDraftApi(draftPayload);
          if (isMounted) draftIdRef.current = saved.id;
        }

        logger.info("[useDraftPersistence] draft saved:", currentProposal.title);
      } catch (error) {
        logger.error("[useDraftPersistence] async save failed:", error);
      }
    }

    // ── Sync fallback (used on beforeunload) ─────────────────────────────────

    function handleBeforeUnload(): void {
      const currentProposal = proposalRef.current;
      if (!currentProposal || !currentProposal.status || currentProposal.status !== "completed") return;
      if (skipIfApprovedRef.current && (currentProposal.approvalStatus === "approved" || currentProposal.approvalStatus === "rejected")) {
        return;
      }

      const uiState = captureUIState(activeSectionRef.current);

      saveToFallbackStore({
        id: draftIdRef.current || String(proposalId),
        savedAt: new Date().toISOString(),
        title: currentProposal.title || "Untitled Proposal",
        clientName: currentProposal.clientName || "",
        stage,
        status: "pending_approval",
        currentStep: wizardStepRef.current,
        lastLocation,
        proposalData: { ...currentProposal, files: [] },
        uiState,
      });
    }

    // ── Visibility change handler ────────────────────────────────────────────

    function handleVisibilityChange(): void {
      if (document.hidden) {
        void saveToDrafts();
      }
    }

    // ── Page hide handler ────────────────────────────────────────────────────

    function handlePageHide(): void {
      void saveToDrafts();
    }

    // ── Register listeners ───────────────────────────────────────────────────

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      isMounted = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      // Save on unmount
      void saveToDrafts();
    };
  }, [enabled, proposalId, lastLocation, stage]);
}
