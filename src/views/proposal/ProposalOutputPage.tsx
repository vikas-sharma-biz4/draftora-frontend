"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { logger } from "@/utils/logger";
import { useProposalWizardStore } from "@/store/features/wizard/proposalWizardSlice";
import { useVisitedPipelineSteps } from "@/store/features/pipeline/pipelineSlice";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";

import {
  updateSection,
  regenerateSection,
  reorderProposalSections,
  estimateProposalHours,
  createVersionDraft as createVersionDraftApi,
} from "@/services/proposal";
import { SECTION_DISPLAY_NAMES, STATIC_SECTION_KEYS } from "@/constants";
import { MESSAGES } from "@/constants/messages";
import { SECTION_AUTOSAVE_DEBOUNCE_MS } from "@/config/config";
import type { ProposalData, EstimatedHoursData } from "@/interfaces/proposalInterfaces";
import { toast } from "@/utils/toast";
import { getErrorMessage } from "@/utils/errorUtils";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { useProposalPageData } from "@/hooks/useProposalPageData";
import { useSectionScrollSpy } from "@/hooks/useSectionScrollSpy";
import { useProposalApproval } from "@/hooks/useProposalApproval";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDraftStore } from "@/store/features/drafts/draftSlice";

import styles from "./ProposalOutputPage.module.scss";

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
  const pendingEditsRef = useRef<Record<string, string>>({});
  const draftUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Lazy version draft: starts as the original proposal id, switches to the new draft id
  // on the first mutation so the user edits immediately without a click or page reload.
  const activeSaveProposalIdRef = useRef<number>(proposalId);
  // Deduplication guard — stores the in-flight creation Promise so rapid consecutive
  // saves all await the same draft instead of spawning multiple versions.
  const versionCreationRef = useRef<Promise<number | null> | null>(null);
  const proposalSectionsRef = useRef<Record<string, string>>({});
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

  const { handleScrollToSection } = useSectionScrollSpy(
    proposal?.selectedSections,
    mounted,
    activeSection,
    setActiveSection
  );

  // Intercept browser back button to always navigate to review page
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      router.push("/review");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // Warn before tab close if there are pending autosave edits that haven't been flushed yet
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent): void {
      if (draftUpdateTimerRef.current !== null) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Approval workflow state
  const { isApproving, isRejecting, executeApprovalAction } = useProposalApproval({
    proposalId,
    onApprovalSuccess: (status) => {
      setProposal((prev) => {
        if (!prev) return prev;
        return { ...prev, approvalStatus: status };
      });
      updateProposalInStore(proposalId, { approvalStatus: status });
    },
    onCacheInvalidate: invalidateCache,
  });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    actionType: "approve" | "reject" | null;
  }>({ isOpen: false, message: "", actionType: null });

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
        toast.success(MESSAGES.HOURS_ESTIMATED);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, "Failed to estimate hours. Please try again."));
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
      toast.error(getErrorMessage(error, "Failed to estimate hours. Please try again."));
    } finally {
      setIsEstimatingHours(false);
    }
  }

  // ── Section editing callbacks ────────────────────────────────────────────────

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
            draftUpdateTimerRef.current = null;
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
          }, SECTION_AUTOSAVE_DEBOUNCE_MS);
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

  // Clean up draft-update debounce timer on unmount
  useEffect(() => {
    return () => {
      if (draftUpdateTimerRef.current) clearTimeout(draftUpdateTimerRef.current);
    };
  }, []);

  const handleRegenerate = useCallback(
    async (key: string, instructions?: string): Promise<string | null> => {
      const targetId = isHistoryProposal ? await ensureVersionDraftId() : proposalId;
      try {
        const newContent = await regenerateSection(targetId, key, instructions);
        handleContentChange(key, newContent);
        toast.success(MESSAGES.PROPOSAL_SECTION_REGENERATED);
        return newContent;
      } catch {
        toast.error(MESSAGES.PROPOSAL_SECTION_REGEN_FAILED);
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
      toast.error(MESSAGES.PROPOSAL_STATIC_SECTION_NOT_ALLOWED);
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

  // ── Render ───────────────────────────────────────────────────────────────────

  const sectionMetas = useMemo<SectionMeta[]>(() => {
    const displayNames = proposal?.sectionDisplayNames ?? {};
    return (proposal?.selectedSections ?? []).map((key) => ({
      key,
      label: resolveSectionLabel(key, displayNames),
      hasContent: Boolean(proposal?.sections?.[key]),
      isStatic: (STATIC_SECTION_KEYS as readonly string[]).includes(key),
    }));
  }, [proposal?.selectedSections, proposal?.sectionDisplayNames, proposal?.sections]);

  // Show loading state while fetching
  if (!mounted || (isLoading && !proposal)) {
    return (
      <PageLayout noPadding>
        <div className={`proposal-content ${styles.loadingState}`}>
          <ProposalSkeleton />
        </div>
      </PageLayout>
    );
  }

  // Show error state if there's an error and no proposal data
  if (errorMessage && !proposal) {
    return (
      <PageLayout noPadding>
        <div className={`proposal-content ${styles.errorContainer}`}>
          <div className={`card ${styles.errorCard}`}>
            <h2 className={styles.errorHeading}>Failed to Load Proposal</h2>
            <p className={styles.errorMessage}>{errorMessage}</p>
            <div className={styles.errorActions}>
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
        <div className={`proposal-content ${styles.loadingState}`}>
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
            <div className={styles.historyBanner}>
              {createdVersionLabel ? (
                <>
                  Editing{" "}
                  <strong className={styles.historyBannerVersion}>V{createdVersionLabel}</strong> —
                  changes are saved to this version draft automatically.
                </>
              ) : (
                <>
                  This proposal is{" "}
                  <strong className={styles.historyBannerStatus}>{proposal.approvalStatus}</strong>.
                  Start editing — a new version draft will be created automatically.
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
