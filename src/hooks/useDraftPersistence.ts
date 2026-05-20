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


function captureUIState(activeSection: string): DraftUIState {
  return {
    scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
    activeSection: activeSection || null,
    expandedSections: [],
    lastVisibleSection: null,
  };
}

const AUTOSAVE_FALLBACK_KEY = "drafts_autosave_fallback";

function saveToFallbackStore(draftItem: Record<string, unknown>): void {
  try {
    const raw = localStorage.getItem(AUTOSAVE_FALLBACK_KEY);
    const existing: Array<{ id: string }> = raw ? JSON.parse(raw) : [];
    const idx = existing.findIndex((d) => d.id === draftItem.id);
    if (idx >= 0) {
      existing[idx] = draftItem as typeof existing[0];
    } else {
      existing.unshift(draftItem as typeof existing[0]);
    }
    localStorage.setItem(AUTOSAVE_FALLBACK_KEY, JSON.stringify(existing));
  } catch (error) {
    logger.error("[useDraftPersistence] fallback save failed:", error);
  }
}


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

    // ── Core save logic — no mount guard (safe: only updates refs, no state setters) ──

    async function performSave(): Promise<void> {
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
            draftIdRef.current = draftId;
          }
        }

        if (draftId) {
          await updateDraftApi(draftId, draftPayload);
        } else {
          const saved = await saveDraftApi(draftPayload);
          draftIdRef.current = saved.id;
        }

        logger.info("[useDraftPersistence] draft saved:", currentProposal.title);
      } catch (error) {
        logger.error("[useDraftPersistence] save failed:", error);
      }
    }

    // ── Guarded save — used by event listeners to skip stale in-flight calls ──

    async function saveToDrafts(): Promise<void> {
      if (!isMounted) return;
      await performSave();
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
      // Call performSave() directly BEFORE setting isMounted=false.
      // saveToDrafts() checks isMounted and would return immediately in cleanup,
      // making the unmount save a dead code path. performSave() has no mount guard
      // and is safe after unmount because it only mutates refs, not React state.
      void performSave();
      isMounted = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [enabled, proposalId, lastLocation, stage]);
}
