"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { logger } from "@/utils/logger";
import { useProposalWizardStore } from "@/store/features/wizard/proposalWizardSlice";
import { useVisitedPipelineSteps } from "@/store/features/pipeline/pipelineSlice";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";
import { toast } from "@/utils/toast";

import {
  updateSection,
  regenerateSection,
  updateApprovalStatus,
} from "@/services/proposal.service";
import { deleteDraft as deleteDraftApi, getDraftByProposalId } from "@/services/draft.service";
import { SECTION_DISPLAY_NAMES } from "@/constants";
import type { ProposalData } from "@/interfaces/proposalInterfaces";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { useProposalPageData } from "@/hooks/useProposalPageData";

const ProposalSectionEditor = dynamic(
  () => import("@/components/proposal/ProposalSectionEditor"),
  { ssr: false }
);

const ProposalSkeleton = dynamic(
  () => import("@/components/proposal/ProposalSkeleton"),
  { ssr: false }
);

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

interface SectionMeta {
  key: string;
  label: string;
  hasContent: boolean;
}

function resolveSectionLabel(
  key: string,
  displayNames: Record<string, string>
): string {
  return (
    displayNames[key] ??
    SECTION_DISPLAY_NAMES[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Detects when backend returned an error placeholder instead of real content */
function isErrorContent(content: string | undefined): boolean {
  if (!content) return true;
  const lower = content.toLowerCase();
  return lower.includes("could not be generated") ||
         lower.includes("please regenerate") ||
         lower.includes("generation failed") ||
         lower.includes("unable to generate");
}

export default function ProposalOutputPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetProposal = useProposalWizardStore((s) => s.resetProposal);
  const visitedPipelineSteps = useVisitedPipelineSteps();
  const handleSaveDraft = useSaveDraft();
  const invalidateCache = useProposalStore(state => state.invalidateCache);
  const updateProposalInStore = useProposalStore(state => state.updateProposal);
  const proposalId = Number(params.id);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Data fetching + auto-save hook
  const {
    proposal,
    setProposal,
    isLoading,
    errorMessage,
    activeSection,
    setActiveSection,
  } = useProposalPageData(proposalId, searchParams);

  // Approval workflow state
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; actionType: "approve" | "reject" | null }>({
    isOpen: false,
    message: "",
    actionType: null,
  });

  // ── Section editing callbacks ────────────────────────────────────────────────

  function handleScrollToSection(key: string): void {
    setActiveSection(key);
    const el = document.getElementById(`section-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const handleContentChange = useCallback((key: string, html: string): void => {
    setProposal((prev) => {
      if (!prev) return prev;
      return { ...prev, sections: { ...(prev.sections ?? {}), [key]: html } };
    });
  }, []);

  const handleSaveSection = useCallback(async (key: string, content: string): Promise<void> => {
    try {
      await updateSection(proposalId, key, content);
      toast.success("Section saved.");
    } catch {
      toast.error("Failed to save section.");
    }
  }, [proposalId]);

  const handleRegenerate = useCallback(async (key: string, instructions?: string): Promise<string | null> => {
    try {
      const newContent = await regenerateSection(proposalId, key, instructions);
      handleContentChange(key, newContent);
      toast.success("Section regenerated.");
      return newContent;
    } catch {
      toast.error("Regeneration failed.");
      return null;
    }
  }, [proposalId, handleContentChange]);

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

  function handleSectionAdded(key: string, label: string, content: string): void {
    setProposal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        selectedSections: [...prev.selectedSections, key],
        sectionDisplayNames: { ...(prev.sectionDisplayNames ?? {}), [key]: label },
        sections: { ...(prev.sections ?? {}), [key]: content },
      };
    });
    setActiveSection(key);
    setTimeout(() => {
      const el = document.getElementById(`section-${key}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
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

  async function executeApprovalAction(actionType: "approve" | "reject"): Promise<void> {
    const status = actionType === "approve" ? "approved" : "rejected";
    const setLoading = actionType === "approve" ? setIsApproving : setIsRejecting;
    const successMessage = actionType === "approve"
      ? "Proposal approved and moved to history!"
      : "Proposal rejected and moved to history";

    setLoading(true);
    try {
      await updateApprovalStatus(proposalId, status);

      // Remove from drafts via API
      try {
        const proposalDraft = await getDraftByProposalId(proposalId);
        if (proposalDraft) {
          await deleteDraftApi(proposalDraft.id);
        }
      } catch (draftError) {
        logger.error("Failed to remove draft:", draftError);
      }

      setProposal((prev) => {
        if (!prev) return prev;
        return { ...prev, approvalStatus: status };
      });

      updateProposalInStore(proposalId, { approvalStatus: status });
      invalidateCache();

      toast.success(successMessage);

      await new Promise(resolve => setTimeout(resolve, 500));
      router.push("/history");
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${actionType} proposal`;
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const displayNames = proposal?.sectionDisplayNames ?? {};
  const sectionMetas: SectionMeta[] = (proposal?.selectedSections ?? []).map(
    (key) => ({
      key,
      label: resolveSectionLabel(key, displayNames),
      hasContent: Boolean(proposal?.sections?.[key]) && !isErrorContent(proposal?.sections?.[key]),
    })
  );
  const allSectionsHaveError = sectionMetas.length > 0 && sectionMetas.every((s) => isErrorContent(proposal?.sections?.[s.key]));

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
        <div className="proposal-content" style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
          <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
            <h2 style={{ color: "var(--color-danger)", marginBottom: "1rem" }}>Failed to Load Proposal</h2>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
              {errorMessage}
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button
                className="btn btn-primary"
                onClick={() => router.push("/review")}
              >
                ← Back to Review
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => window.location.reload()}
              >
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
            onSaveDraft={handleSaveDraft}
            onApprove={handleApprove}
            onReject={handleReject}
            onExecuteAction={executeApprovalAction}
            confirmModal={confirmModal}
            onConfirmModalClose={() => setConfirmModal({ isOpen: false, message: "", actionType: null })}
          />
        </div>

        <div className="proposal-layout">
        <ProposalSidebar
          proposalId={proposalId}
          sections={sectionMetas}
          activeSection={activeSection}
          onSectionClick={handleScrollToSection}
          onSectionRenamed={handleSectionRenamed}
          onSectionRemoved={handleSectionRemoved}
          onSectionAdded={handleSectionAdded}
        />

        <div className="proposal-content">
          {errorMessage && (
            <div className="alert-error">
              {errorMessage}
            </div>
          )}

          {isLoading && sectionMetas.length === 0 && <ProposalSkeleton />}

          {sectionMetas.map(({ key, label }) => (
            <ProposalSectionEditor
              key={key}
              sectionKey={key}
              label={label}
              rawContent={proposal?.sections?.[key] ?? ""}
              onContentChange={handleContentChange}
              onSave={handleSaveSection}
              onRegenerate={handleRegenerate}
            />
          ))}

          {proposal?.status === "completed" && allSectionsHaveError && (
            <div className="card empty-content-card" style={{ padding: "2rem", textAlign: "center" }}>
              <p className="text-muted font-14" style={{ marginBottom: "1rem" }}>
                Proposal generation completed but no content was produced. This usually means the AI generation service encountered an error.
              </p>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => { window.location.reload(); }}
                >
                  Refresh Page
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { resetProposal(); router.push("/"); }}
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
    </PageLayout>
  );
}
