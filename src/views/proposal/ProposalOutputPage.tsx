"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { logger } from "@/utils/logger";
import { useProposalWizardStore } from "@/store/features/wizard/proposalWizardSlice";
import { useVisitedPipelineSteps } from "@/store/features/pipeline/pipelineSlice";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";

import {
  updateSection,
  regenerateSection,
  updateApprovalStatus,
  reorderProposalSections,
  estimateProposalHours,
  createVersionDraft as createVersionDraftApi,
} from "@/services/proposal";
import { HttpError } from "@/config/httpClient";
import { deleteDraft as deleteDraftApi, getDraftByProposalId } from "@/services/draft.service";
import { SECTION_DISPLAY_NAMES, STATIC_SECTION_KEYS } from "@/constants";
import type { ProposalData, EstimatedHoursData } from "@/interfaces/proposalInterfaces";
import { toast } from "@/utils/toast";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { useProposalPageData } from "@/hooks/useProposalPageData";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDraftStore } from "@/store/features/drafts/draftSlice";

const ProposalSectionEditor = dynamic(() => import("@/components/proposal/ProposalSectionEditor"), {
  ssr: false,
});

const SectionViewMode = dynamic(() => import("@/components/proposal/SectionViewMode"), {
  ssr: false,
});

const ProposalSkeleton = dynamic(() => import("@/components/proposal/ProposalSkeleton"), {
  ssr: false,
});

const PageLayout = dynamic(() => import("@/layouts/AppLayout"), { ssr: false });

const DynamicPipeline = dynamic(() => import("@/components/common/DynamicPipeline"), {
  ssr: false,
});

const ProposalSidebar = dynamic(() => import("@/components/proposal/ProposalSidebar"), {
  ssr: false,
});

const ProposalApprovalBar = dynamic(() => import("@/components/proposal/ProposalApprovalBar"), {
  ssr: false,
});

const EstimateHoursButton = dynamic(() => import("@/components/proposal/EstimateHoursButton"), {
  ssr: false,
});

const EstimateHoursModal = dynamic(() => import("@/components/proposal/EstimateHoursModal"), {
  ssr: false,
});

interface SectionMeta {
  key: string;
  label: string;
  hasContent: boolean;
  isStatic?: boolean;
}

function stripHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined")
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

// Same priority order as the backend's _FEATURE_LIST_SECTION_KEYS.
// First non-empty section wins — covers MVP, design, POC, and scratch layouts.
const FEATURE_LIST_SECTION_KEYS = [
  "high_level_feature_list",
  "poc_feature_list",
  "scope_of_prototype",
  "key_objectives",
  "high_level_scope",
  "proposed_solution",
  "scope",
  "deliverables",
  "implementation_plan",
  "functional_requirements",
  "requirements",
] as const;

function extractFeatureList(sections: Record<string, string>): string {
  for (const key of FEATURE_LIST_SECTION_KEYS) {
    const raw = sections[key];
    if (raw) return stripHtml(raw);
  }
  return "";
}

function resolveSectionLabel(key: string, displayNames: Record<string, string>): string {
  return (
    displayNames[key] ??
    SECTION_DISPLAY_NAMES[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function ProposalOutputPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetProposal = useProposalWizardStore((s) => s.resetProposal);
  const setWizardProposalId = useProposalWizardStore((s) => s.setCurrentProposalId);
  const updateWizardProposalData = useProposalWizardStore((s) => s.updateProposalData);
  const visitedPipelineSteps = useVisitedPipelineSteps();
  const handleSaveDraft = useSaveDraft();
  const invalidateCache = useProposalStore((state) => state.invalidateCache);
  const updateProposalInStore = useProposalStore((state) => state.updateProposal);
  const addVersionDraft = useProposalStore((state) => state.addVersionDraft);
  const proposalId = Number(params.id);
  const currentDraftId = useDraftSessionStore((state) => state.currentDraftId);
  const fromHistory = useDraftSessionStore((state) => state.fromHistory);
  const updateDraftInStore = useDraftStore((state) => state.updateDraftApi);
  const [mounted, setMounted] = useState<boolean>(false);
  const [createdVersionLabel, setCreatedVersionLabel] = useState<string | null>(null);
  const currentActiveSectionRef = useRef<string | null>(null);
  const pendingEditsRef = useRef<Record<string, string>>({});
  const draftUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Lazy version draft: starts as the original proposal id, switches to the new draft id
  // on the first mutation so the user edits immediately without a click or page reload.
  const activeSaveProposalIdRef = useRef<number>(proposalId);
  // Deduplication guard — stores the in-flight creation Promise so rapid consecutive
  // saves all await the same draft instead of spawning multiple versions.
  const versionCreationRef = useRef<Promise<number | null> | null>(null);
  const proposalSectionsRef = useRef<Record<string, string>>({});
  // Prevents the IntersectionObserver from overriding active section during programmatic scroll
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const programmaticScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoEstimatedRef = useRef<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Data fetching + auto-save hook
  const { proposal, setProposal, isLoading, errorMessage, activeSection, setActiveSection } =
    useProposalPageData(proposalId, searchParams);

  const isHistoryProposal = Boolean(proposal && proposal.approvalStatus !== "pending");

  /**
   * Lazily create a version draft on the first mutation of a History proposal.
   *
   * Subsequent calls return the already-created draft id immediately.
   * Concurrent calls (e.g. two rapid section saves) share the same Promise so
   * only one draft is ever created per editing session.
   */
  const ensureVersionDraftId = useCallback(async (): Promise<number> => {
    // Already branched — return the live draft id directly
    if (activeSaveProposalIdRef.current !== proposalId) {
      return activeSaveProposalIdRef.current;
    }

    if (!versionCreationRef.current) {
      versionCreationRef.current = createVersionDraftApi(proposalId, "section_edit")
        .then((draft) => {
          activeSaveProposalIdRef.current = draft.id;
          addVersionDraft({
            id: draft.id,
            title: draft.title,
            clientId: 0,
            clientName: "",
            status: draft.status as "draft" | "generating" | "completed",
            approvalStatus: draft.approvalStatus as "pending" | "approved" | "rejected",
            tone: "professional",
            lengthPreference: "balanced",
            templateType: "scratch",
            createdAt: draft.createdAt,
            updatedAt: draft.createdAt,
            versionLabel: draft.versionLabel,
            parentProposalId: draft.parentProposalId,
            rootProposalId: draft.rootProposalId,
          });
          invalidateCache();
          // Update browser URL without triggering Next.js navigation (no remount)
          window.history.replaceState({}, "", `/proposal/${draft.id}`);
          // Sync the wizard store so ReviewPage sees the NEW draft (pending),
          // not the original History proposal (approved). This prevents ReviewPage
          // from showing the "Edit (New Version)" banner or creating another draft.
          setWizardProposalId(draft.id);
          updateWizardProposalData({ approvalStatus: "pending" });
          setCreatedVersionLabel(draft.versionLabel ?? null);
          logger.info(
            "[ProposalOutputPage] Lazy version draft created | id=%d | label=%s",
            draft.id,
            draft.versionLabel
          );
          return draft.id;
        })
        .catch((err) => {
          logger.error("[ProposalOutputPage] Failed to create version draft lazily", err);
          versionCreationRef.current = null; // Allow retry on next save
          return null;
        });
    }

    const id = await versionCreationRef.current;
    // Fall back to original id so the save doesn't silently disappear
    return id ?? proposalId;
  }, [
    proposalId,
    addVersionDraft,
    invalidateCache,
    setWizardProposalId,
    updateWizardProposalData,
    setCreatedVersionLabel,
  ]);

  // Keep proposalSectionsRef in sync so the debounced draft update can access latest sections
  useEffect(() => {
    if (proposal?.sections) {
      proposalSectionsRef.current = proposal.sections as Record<string, string>;
    }
  }, [proposal?.sections]);

  // Sync ref when activeSection changes from user clicks (not from scroll)
  useEffect(() => {
    currentActiveSectionRef.current = activeSection;
  }, [activeSection]);

  // Intercept browser back button to always navigate to review page
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Intercept browser back navigation and redirect to review
      event.preventDefault();
      router.push("/review");
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [router]);

  /**
   * Scroll spy: highlight the sidebar item for the section currently being read.
   *
   * Strategy: on every scroll event, find the section whose top edge has most
   * recently crossed the container's top edge (largest negative offset ≤ TRIGGER_OFFSET).
   * This correctly handles tall sections (images, tables) that remain partially
   * visible long after the reader has moved past them — unlike an IntersectionObserver
   * "smallest top" approach which keeps the old section active far too long.
   */
  useEffect(() => {
    if (!proposal || !mounted) return;

    const sectionKeys = proposal.selectedSections ?? [];
    if (sectionKeys.length === 0) return;

    const scrollRoot = document.querySelector<HTMLElement>(".main-content");
    if (!scrollRoot) return;

    // px below the container's top edge that triggers a section switch.
    // A small positive offset accounts for section headers having some padding.
    const TRIGGER_OFFSET = 80;

    function updateActiveSection(): void {
      if (isProgrammaticScrollRef.current) return;

      const containerTop = scrollRoot!.getBoundingClientRect().top;

      let bestKey: string | null = null;
      let bestRelTop = -Infinity;

      // Pick the section whose top is the largest value still ≤ TRIGGER_OFFSET
      // (i.e., the section that most recently scrolled past the container's top edge).
      sectionKeys.forEach((key) => {
        const el = document.getElementById(`section-${key}`);
        if (!el) return;
        const relTop = el.getBoundingClientRect().top - containerTop;
        if (relTop <= TRIGGER_OFFSET && relTop > bestRelTop) {
          bestRelTop = relTop;
          bestKey = key;
        }
      });

      // Fallback: nothing has reached the trigger yet — pick first visible section.
      if (!bestKey) {
        let firstRelTop = Infinity;
        sectionKeys.forEach((key) => {
          const el = document.getElementById(`section-${key}`);
          if (!el) return;
          const relTop = el.getBoundingClientRect().top - containerTop;
          if (relTop < firstRelTop) {
            firstRelTop = relTop;
            bestKey = key;
          }
        });
      }

      if (bestKey && bestKey !== currentActiveSectionRef.current) {
        currentActiveSectionRef.current = bestKey;
        setActiveSection(bestKey);
      }
    }

    scrollRoot.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection, { passive: true });

    // Set the correct active section immediately on mount / proposal load.
    updateActiveSection();

    return () => {
      scrollRoot.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [proposal, mounted, setActiveSection]);

  // Approval workflow state
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    actionType: "approve" | "reject" | null;
  }>({
    isOpen: false,
    message: "",
    actionType: null,
  });

  // Hours estimation state
  const [estimatedHoursData, setEstimatedHoursData] = useState<EstimatedHoursData | null>(null);
  const [isEstimatingHours, setIsEstimatingHours] = useState<boolean>(false);
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState<boolean>(false);

  // Seed estimated hours from the loaded proposal (no extra API call on refresh)
  useEffect(() => {
    if (proposal?.estimatedHoursData) {
      setEstimatedHoursData(proposal.estimatedHoursData);
    }
  }, [proposal?.estimatedHoursData]);

  // Auto-estimate when a proposal first loads with no existing estimate
  useEffect(() => {
    if (!proposal || autoEstimatedRef.current || proposal.estimatedHoursData) return;
    autoEstimatedRef.current = true;
    setIsEstimatingHours(true);
    estimateProposalHours(proposalId, {})
      .then((result) => {
        setEstimatedHoursData(result);
        toast.success("Hours estimated successfully.");
      })
      .catch((error) => {
        const message =
          error instanceof HttpError
            ? error.message
            : "Failed to estimate hours. Please try again.";
        toast.error(message);
      })
      .finally(() => {
        setIsEstimatingHours(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal]);

  async function handleEstimateHours(
    customFeatureList?: string,
    customPrompt?: string
  ): Promise<void> {
    setIsEstimatingHours(true);
    try {
      const result = await estimateProposalHours(proposalId, {
        custom_feature_list: customFeatureList,
        custom_prompt: customPrompt,
      });
      setEstimatedHoursData(result);
      setIsEstimateModalOpen(false);
      toast.success("Hours estimated successfully.");
    } catch (error) {
      const message =
        error instanceof HttpError ? error.message : "Failed to estimate hours. Please try again.";
      toast.error(message);
    } finally {
      setIsEstimatingHours(false);
    }
  }

  // ── Section editing callbacks ────────────────────────────────────────────────

  function handleScrollToSection(key: string): void {
    setActiveSection(key);
    currentActiveSectionRef.current = key;

    // Suppress IntersectionObserver for 1.5s so it doesn't override the click-selected section
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 1500);

    // Defer scroll to the next animation frame so React can commit the state update first.
    // Using getBoundingClientRect inside rAF gives stable layout coordinates.
    requestAnimationFrame(() => {
      const el = document.getElementById(`section-${key}`);
      if (!el) return;

      const container = document.querySelector<HTMLElement>(".main-content");
      if (!container) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      // Viewport-relative positions are stable within a single animation frame.
      // Adding container.scrollTop converts to absolute scroll-container coordinates.
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      const targetScrollTop = container.scrollTop + (elTop - containerTop) - 24;
      container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
    });
  }

  const handleContentChange = useCallback((key: string, html: string): void => {
    setProposal((prev) => {
      if (!prev) return prev;
      return { ...prev, sections: { ...(prev.sections ?? {}), [key]: html } };
    });
  }, []);

  const handleSaveSection = useCallback(
    async (key: string, content: string): Promise<void> => {
      // For History proposals: lazily create a version draft on first save,
      // then target all subsequent saves at the new draft id.
      const targetId = isHistoryProposal ? await ensureVersionDraftId() : proposalId;
      try {
        await updateSection(targetId, key, content);

        // Debounce-update the draft with edited content (1.5s) so reopening the draft shows edits
        if (currentDraftId && !fromHistory) {
          pendingEditsRef.current = { ...pendingEditsRef.current, [key]: content };

          if (draftUpdateTimerRef.current) clearTimeout(draftUpdateTimerRef.current);
          draftUpdateTimerRef.current = setTimeout(async () => {
            const edits = pendingEditsRef.current;
            pendingEditsRef.current = {};
            // Merge edits into the full sections to avoid wiping out other sections via PUT
            const fullContent = { ...proposalSectionsRef.current, ...edits };
            try {
              await updateDraftInStore(currentDraftId, {
                generatedContent: fullContent,
                lastLocation: "web_view",
                stage: "generated",
                hasEdits: true,
              });
            } catch (err) {
              logger.warn("[ProposalOutputPage] Draft update after edit failed", err);
            }
          }, 1500);
        }
      } catch {
        // Silently ignore save failures
      }
    },
    [
      isHistoryProposal,
      ensureVersionDraftId,
      proposalId,
      currentDraftId,
      fromHistory,
      updateDraftInStore,
    ]
  );

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (draftUpdateTimerRef.current) clearTimeout(draftUpdateTimerRef.current);
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
    };
  }, []);

  const handleRegenerate = useCallback(
    async (key: string, instructions?: string): Promise<string | null> => {
      const targetId = isHistoryProposal ? await ensureVersionDraftId() : proposalId;
      try {
        const newContent = await regenerateSection(targetId, key, instructions);
        handleContentChange(key, newContent);
        toast.success("Section regenerated.");
        return newContent;
      } catch {
        toast.error("Regeneration failed");
        return null;
      }
    },
    [isHistoryProposal, ensureVersionDraftId, proposalId, handleContentChange]
  );

  // ── Sidebar callbacks ───────────────────────────────────────────────────────

  function handleSectionRenamed(key: string, newLabel: string): void {
    setProposal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sectionDisplayNames: { ...(prev.sectionDisplayNames ?? {}), [key]: newLabel },
      };
    });
  }

  function handleSectionRemoved(key: string): void {
    // Prevent removal of static sections
    if ((STATIC_SECTION_KEYS as readonly string[]).includes(key)) {
      toast.error("Not allowed on static sections");
      return;
    }

    setProposal((prev) => {
      if (!prev) return prev;
      const remaining = prev.selectedSections.filter((k) => k !== key);
      const sectionsCopy = { ...(prev.sections ?? {}) };
      delete sectionsCopy[key];
      return { ...prev, selectedSections: remaining, sections: sectionsCopy };
    });
    if (activeSection === key) {
      const remaining = (proposal?.selectedSections ?? []).filter((k) => k !== key);
      if (remaining.length > 0) setActiveSection(remaining[0]);
    }
  }

  async function handleSectionAdded(
    key: string,
    label: string,
    content: string,
    afterKey?: string,
    formatType?: string
  ): Promise<void> {
    const currentSections = proposal?.selectedSections ?? [];
    let newSelected: string[];

    const insertBeforeStatic = (sections: string[]): string[] => {
      const firstStaticIdx = sections.findIndex((k) =>
        (STATIC_SECTION_KEYS as readonly string[]).includes(k)
      );
      return firstStaticIdx >= 0
        ? [...sections.slice(0, firstStaticIdx), key, ...sections.slice(firstStaticIdx)]
        : [...sections, key];
    };

    if (afterKey) {
      const idx = currentSections.indexOf(afterKey);
      newSelected =
        idx >= 0
          ? [...currentSections.slice(0, idx + 1), key, ...currentSections.slice(idx + 1)]
          : insertBeforeStatic(currentSections);
    } else {
      newSelected = insertBeforeStatic(currentSections);
    }

    const newDisplayNames = { ...(proposal?.sectionDisplayNames ?? {}), [key]: label };

    // Update sectionTypes if formatType is provided
    const newSectionTypes = formatType
      ? { ...(proposal?.sectionTypes ?? {}), [key]: formatType }
      : proposal?.sectionTypes;

    setProposal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        selectedSections: newSelected,
        sectionDisplayNames: newDisplayNames,
        sections: { ...(prev.sections ?? {}), [key]: content },
        sectionTypes: newSectionTypes,
      };
    });
    setActiveSection(key);

    // Persist insertion order to backend — for History proposals, ensure a version draft
    // exists first so the reorder targets the editable draft, not the immutable History row.
    const reorderTargetId = isHistoryProposal ? await ensureVersionDraftId() : proposalId;
    reorderProposalSections(reorderTargetId, {
      order: newSelected,
      sectionDisplayNames: newDisplayNames,
    }).catch((err) => {
      logger.warn("[ProposalOutputPage] reorder after add failed", err);
    });

    setTimeout(() => {
      const el = document.getElementById(`section-${key}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function handleSectionsReordered(newOrder: string[]): void {
    setProposal((prev) => {
      if (!prev) return prev;
      return { ...prev, selectedSections: newOrder };
    });
  }

  // ── Approve/Reject handlers ──────────────────────────────────────────────────

  function handleApprove(): void {
    setConfirmModal({
      isOpen: true,
      message: "Are you sure you want to approve this proposal?",
      actionType: "approve",
    });
  }

  function handleReject(): void {
    setConfirmModal({
      isOpen: true,
      message: "Are you sure you want to reject this proposal?",
      actionType: "reject",
    });
  }

  async function executeApprovalAction(
    actionType: "approve" | "reject",
    signal: AbortSignal
  ): Promise<void> {
    const status = actionType === "approve" ? "approved" : "rejected";
    const setLoading = actionType === "approve" ? setIsApproving : setIsRejecting;
    const successMessage =
      actionType === "approve"
        ? "Proposal approved and moved to history!"
        : "Proposal rejected and moved to history";

    logger.info(`[Approval Flow] Starting ${actionType} action for proposal ${proposalId}`);
    setLoading(true);
    try {
      // Update approval status in backend
      logger.info(`[Approval Flow] Calling API to update approval status to: ${status}`);
      await updateApprovalStatus(proposalId, status, signal);
      logger.info(`[Approval Flow] API call successful - approval status updated to: ${status}`);

      // User may have clicked Cancel while the request was in-flight but it already completed
      if (signal.aborted) return;

      // Remove from drafts via API
      try {
        const proposalDraft = await getDraftByProposalId(proposalId);
        if (proposalDraft) {
          await deleteDraftApi(proposalDraft.id);
        }
      } catch (draftError) {
        logger.error("Failed to remove draft:", draftError);
      }

      if (signal.aborted) return;

      // CRITICAL: Invalidate cache FIRST to ensure history page fetches fresh data
      logger.info(`[Approval Flow] Invalidating Zustand cache to force fresh data fetch`);
      invalidateCache();

      // Then update local state for immediate UI feedback
      setProposal((prev) => {
        if (!prev) return prev;
        return { ...prev, approvalStatus: status };
      });

      // Update Zustand store (optimistic update)
      logger.info(`[Approval Flow] Updating Zustand store with new approval status: ${status}`);
      updateProposalInStore(proposalId, { approvalStatus: status });

      toast.success(successMessage);

      logger.info(`[Approval Flow] Redirecting to /history in 500ms`);
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (signal.aborted) return;

      router.push("/history");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const message = error instanceof Error ? error.message : `Failed to ${actionType} proposal`;
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const displayNames = proposal?.sectionDisplayNames ?? {};
  const sectionMetas: SectionMeta[] = (proposal?.selectedSections ?? []).map((key) => ({
    key,
    label: resolveSectionLabel(key, displayNames),
    hasContent: Boolean(proposal?.sections?.[key]),
    isStatic: (STATIC_SECTION_KEYS as readonly string[]).includes(key),
  }));

  // Show loading state while fetching
  if (!mounted || (isLoading && !proposal)) {
    return (
      <PageLayout noPadding>
        <div className="proposal-content" style={{ padding: "2rem" }}>
          <ProposalSkeleton />
        </div>
      </PageLayout>
    );
  }

  // Show error state if there's an error and no proposal data
  if (errorMessage && !proposal) {
    return (
      <PageLayout noPadding>
        <div
          className="proposal-content"
          style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}
        >
          <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
            <h2 style={{ color: "var(--color-danger)", marginBottom: "1rem" }}>
              Failed to Load Proposal
            </h2>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
              {errorMessage}
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={() => router.push("/review")}>
                ← Back to Review
              </button>
              <button className="btn btn-secondary" onClick={() => window.location.reload()}>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Don't render if proposal data is not loaded yet
  if (!proposal) {
    return (
      <PageLayout noPadding>
        <div className="proposal-content" style={{ padding: "2rem" }}>
          <ProposalSkeleton />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout noPadding>
      <div className="proposal-header-bar">
        <DynamicPipeline
          currentStage="generated"
          completedSteps={[1, 2, 3]}
          visitedSteps={visitedPipelineSteps}
          visible={true}
          proposalId={proposalId}
        />
        <ProposalApprovalBar
          proposalId={proposalId}
          approvalStatus={proposal.approvalStatus}
          isApproving={isApproving}
          isRejecting={isRejecting}
          onSaveDraft={fromHistory ? undefined : handleSaveDraft}
          onApprove={handleApprove}
          onReject={handleReject}
          onExecuteAction={executeApprovalAction}
          confirmModal={confirmModal}
          onConfirmModalClose={() =>
            setConfirmModal({ isOpen: false, message: "", actionType: null })
          }
          estimateHoursContent={
            proposal.status === "completed" ? (
              <EstimateHoursButton
                estimatedHoursData={estimatedHoursData}
                isEstimating={isEstimatingHours}
                onOpenModal={() => setIsEstimateModalOpen(true)}
              />
            ) : undefined
          }
        />
      </div>

      <EstimateHoursModal
        isOpen={isEstimateModalOpen}
        onClose={() => setIsEstimateModalOpen(false)}
        onSubmit={handleEstimateHours}
        defaultFeatureList={extractFeatureList(proposal.sections ?? {})}
        previousEstimate={estimatedHoursData}
        isSubmitting={isEstimatingHours}
      />

      <div className="proposal-layout">
        <ProposalSidebar
          proposalId={proposalId}
          sections={sectionMetas}
          activeSection={activeSection}
          onSectionClick={handleScrollToSection}
          onSectionRenamed={handleSectionRenamed}
          onSectionRemoved={handleSectionRemoved}
          onSectionAdded={handleSectionAdded}
          onSectionsReordered={handleSectionsReordered}
          templateType={proposal?.templateType}
        />

        <div className="proposal-content">
          {errorMessage && <div className="alert-error">{errorMessage}</div>}

          {isLoading && sectionMetas.length === 0 && <ProposalSkeleton />}

          {/* Subtle notice for History (approved / rejected) proposals.
              Editing is allowed immediately — a version draft is created automatically
              on the first save without any button click or page reload. */}
          {isHistoryProposal && (
            <div
              style={{
                padding: "0.5rem 1rem",
                marginBottom: "0.75rem",
                background: "var(--color-surface-raised, #f8f9ff)",
                borderLeft: "3px solid var(--color-primary, #6366f1)",
                borderRadius: "0 4px 4px 0",
                fontSize: "0.8125rem",
                color: "var(--color-text-muted)",
              }}
            >
              {createdVersionLabel ? (
                <>
                  Editing{" "}
                  <strong style={{ fontFamily: "monospace" }}>V{createdVersionLabel}</strong> —
                  changes are saved to this version draft automatically.
                </>
              ) : (
                <>
                  This proposal is{" "}
                  <strong style={{ textTransform: "capitalize" }}>{proposal.approvalStatus}</strong>
                  . Start editing — a new version draft will be created automatically.
                </>
              )}
            </div>
          )}

          {sectionMetas.map(({ key, label, isStatic }) =>
            isStatic ? (
              <div key={key} className="proposal-page" id={`section-${key}`}>
                <div className="proposal-page-header">
                  <h2 className="proposal-page-title">{label}</h2>
                </div>
                <SectionViewMode sectionKey={key} content={proposal?.sections?.[key] ?? ""} />
              </div>
            ) : (
              <ProposalSectionEditor
                key={key}
                proposalId={proposalId}
                sectionKey={key}
                label={label}
                rawContent={proposal?.sections?.[key] ?? ""}
                onContentChange={handleContentChange}
                onSave={handleSaveSection}
              />
            )
          )}

          {proposal?.status === "completed" &&
            sectionMetas.length > 0 &&
            sectionMetas.every((s) => !proposal.sections?.[s.key]) && (
              <div className="card empty-content-card">
                <p className="text-muted font-14">
                  No section content was generated. Please go back and try again.
                </p>
                <button
                  className="btn btn-primary mt-16"
                  onClick={() => {
                    resetProposal();
                    router.push("/");
                  }}
                >
                  Start Over
                </button>
              </div>
            )}
        </div>
      </div>
    </PageLayout>
  );
}
