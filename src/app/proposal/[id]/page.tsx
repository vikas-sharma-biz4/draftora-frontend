"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProposal } from "@/context/ProposalContext";
import { useProposalStore } from "@/redux/features/proposalStore";
import { Pencil, X, Check, Plus, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getProposal,
  getDownloadUrl,
  updateSection,
  regenerateSection,
  addProposalSection,
  removeProposalSection,
  updateApprovalStatus,
} from "@/services/proposalApi";
import { SECTION_DISPLAY_NAMES, HISTORY_STORAGE_KEY } from "@/constants";
import { DIAGRAM_SECTION_KEYS } from "@/utils/contentParser";
import type { ProposalData, WizardStep } from "@/interfaces/proposalInterfaces";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import type { DraftUIState } from "@/interfaces/draftInterfaces";
import { saveDraft as saveDraftApi, updateDraft as updateDraftApi, deleteDraft as deleteDraftApi, listDrafts } from "@/services/draftApi";

const ProposalSectionEditor = dynamic(
  () => import("@/components/proposal/ProposalSectionEditor"),
  { ssr: false }
);

const ProposalSkeleton = dynamic(
  () => import("@/components/proposal/ProposalSkeleton"),
  { ssr: false }
);

const PageLayout = dynamic(() => import("@/components/common/PageLayout"), { ssr: false });

const DynamicPipeline = dynamic(() => import("@/components/common/DynamicPipeline"), {
  ssr: false,
});

import ConfirmModal from "@/components/common/ConfirmModal";

interface SectionMeta {
  key: string;
  label: string;
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

export default function ProposalOutputPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    resetProposal, 
    setCurrentProposalId, 
    updateProposalData, 
    setDraftStage, 
    setCompletedSteps, 
    markStepCompleted, 
    proposalData,
    visitedPipelineSteps,
    syncVisitedStepsFromBackend,
  } = useProposal();
  const handleSaveDraft = useSaveDraft();
  const updateProposalInStore = useProposalStore(state => state.updateProposal);
  const invalidateCache = useProposalStore(state => state.invalidateCache);
  const proposalId = Number(params.id);

  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeSection, setActiveSection] = useState<string>("");
  const [fromHistory, setFromHistory] = useState<boolean>(false);

  // Sidebar section management
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const [addLabelValue, setAddLabelValue] = useState<string>("");
  const [addingSection, setAddingSection] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; actionType: "approve" | "reject" | null }>({
    isOpen: false,
    message: "",
    actionType: null,
  });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if navigating from History
  useEffect(() => {
    const fromParam = searchParams.get("from");
    setFromHistory(fromParam === "history");
  }, [searchParams]);

  // Mark step 3 as visited when this page loads
  useEffect(() => {
    markStepCompleted(3);
  }, [markStepCompleted]);

  // Sync visited steps from backend on mount
  useEffect(() => {
    if (proposalId) {
      syncVisitedStepsFromBackend(proposalId);
    }
  }, [proposalId, syncVisitedStepsFromBackend]);

  const fetchProposal = useCallback(async (): Promise<void> => {
    try {
      const data = await getProposal(proposalId);
      setProposal(data);
      
      // Set current proposal ID for regeneration flow
      setCurrentProposalId(proposalId);

      if (data.status === "completed") {
        setIsLoading(false);
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        const sections = data.selectedSections ?? [];
        if (sections.length > 0 && !activeSection) {
          setActiveSection(sections[0]);
        }
        
        // Update proposal context with current data for regeneration
        updateProposalData({
          title: data.title,
          clientName: data.clientName,
          clientId: data.clientId,
          description: data.description,
          tone: data.tone,
          lengthPreference: data.lengthPreference,
          language: data.language,
          aiModel: data.aiModel,
          selectedSections: data.selectedSections,
          sectionDisplayNames: data.sectionDisplayNames,
          contextualInstructions: data.contextualInstructions,
          webReferences: data.webReferences,
        });
        setDraftStage("generated");
        setCompletedSteps([1, 2, 3]);
        return;
      }

      if (data.status === "failed") {
        setIsLoading(false);
        setErrorMessage("Proposal generation failed. Please go back and try again.");
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        return;
      }

      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      router.replace(`/generating/${proposalId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load proposal.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }, [proposalId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchProposal();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchProposal]);

  // Restore scroll position and active section from draft UI state
  useEffect(() => {
    try {
      const uiStateStr = sessionStorage.getItem("draft_ui_state");
      if (uiStateStr) {
        const uiState = JSON.parse(uiStateStr);
        
        // Restore active section if available
        if (uiState.activeSection && proposal?.selectedSections?.includes(uiState.activeSection)) {
          setActiveSection(uiState.activeSection);
        }
        
        // Restore scroll position
        if (uiState.scrollPosition > 0) {
          setTimeout(() => {
            window.scrollTo({
              top: uiState.scrollPosition,
              behavior: "smooth",
            });
          }, 300);
        }
        
        sessionStorage.removeItem("draft_ui_state");
      }
    } catch {
      // Ignore errors restoring UI state
    }
  }, [proposal]);

  // Auto-save to drafts when navigating away without approval/rejection
  useEffect(() => {
    let currentDraftId: string | null = null;
    let isMounted = true;

    async function saveToDrafts(): Promise<void> {
      if (!proposal || !proposal.status || proposal.status !== "completed") return;
      
      // Skip auto-save for approved/rejected proposals
      if (proposal.approvalStatus === "approved" || proposal.approvalStatus === "rejected") {
        return;
      }
      
      try {
        // Capture UI state for restoration
        const uiState: DraftUIState = {
          scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
          activeSection: activeSection,
          expandedSections: [],
          lastVisibleSection: null,
        };

        const draftPayload = {
          proposalId: proposalId,
          title: proposal.title,
          clientName: proposal.clientName,
          status: "draft" as const,
          lastLocation: "WEB_VIEW" as const,
          stage: "generated" as const,
          wizardState: {
            proposalData: proposal,
            currentStep: 5 as WizardStep,
            maxStepReached: 5 as WizardStep,
            completedSteps: [1, 2, 3, 4, 5],
          },
          generatedContent: proposal.sections || {},
          uiState,
        };

        // Check if draft already exists for this proposal
        if (!currentDraftId) {
          const existingDrafts = await listDrafts();
          const existingDraft = existingDrafts.find(d => d.proposalId === proposalId);
          if (existingDraft) {
            currentDraftId = existingDraft.id;
          }
        }

        if (currentDraftId) {
          await updateDraftApi(currentDraftId, draftPayload);
        } else {
          const saved = await saveDraftApi(draftPayload);
          if (isMounted) {
            currentDraftId = saved.id;
          }
        }
      } catch (error) {
        console.error("Failed to save draft:", error);
      }
    }

    const handleBeforeUnload = (): void => {
      // Fallback to localStorage for synchronous save
      if (!proposal || !proposal.status || proposal.status !== "completed") return;
      
      try {
        const uiState: DraftUIState = {
          scrollPosition: typeof window !== "undefined" ? window.scrollY : 0,
          activeSection: activeSection,
          expandedSections: [],
          lastVisibleSection: null,
        };

        const draftItem = {
          id: currentDraftId || proposalId.toString(),
          title: proposal.title,
          clientName: proposal.clientName,
          stage: "generated" as const,
          status: "pending_approval" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          data: proposal,
          uiState,
        };
        
        const drafts = JSON.parse(localStorage.getItem("drafts_autosave_fallback") || "[]");
        const existingIndex = drafts.findIndex((d: any) => d.id === draftItem.id);
        
        if (existingIndex >= 0) {
          drafts[existingIndex] = draftItem;
        } else {
          drafts.unshift(draftItem);
        }
        
        localStorage.setItem("drafts_autosave_fallback", JSON.stringify(drafts));
      } catch (error) {
        console.error("Failed to save draft fallback:", error);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      isMounted = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Only save on unmount, not on every re-render
      void saveToDrafts();
    };
  }, [proposalId]); // Only depend on proposalId to avoid re-running on every state change

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

  // ── Sidebar actions ──────────────────────────────────────────────────────────

  function startRename(key: string): void {
    setRenamingKey(key);
    setRenameValue(resolveSectionLabel(key, proposal?.sectionDisplayNames ?? {}));
  }

  function saveRename(key: string): void {
    const label = renameValue.trim();
    if (!label) return;
    setProposal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sectionDisplayNames: { ...(prev.sectionDisplayNames ?? {}), [key]: label },
      };
    });
    setRenamingKey(null);
  }

  async function handleRemoveSection(key: string): Promise<void> {
    const currentSections = proposal?.selectedSections ?? [];
    if (currentSections.length <= 1) {
      toast.error("At least one section is required.");
      return;
    }
    try {
      await removeProposalSection(proposalId, key);
      setProposal((prev) => {
        if (!prev) return prev;
        const remaining = prev.selectedSections.filter((k) => k !== key);
        const sectionsCopy = { ...(prev.sections ?? {}) };
        delete sectionsCopy[key];
        return { ...prev, selectedSections: remaining, sections: sectionsCopy };
      });
      if (activeSection === key) {
        const remaining = currentSections.filter((k) => k !== key);
        if (remaining.length > 0) setActiveSection(remaining[0]);
      }
      toast.success("Section removed.");
    } catch {
      toast.error("Failed to remove section.");
    }
  }

  async function handleAddSection(): Promise<void> {
    const label = addLabelValue.trim();
    if (!label) return;
    const key =
      "custom_" +
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40);

    if (proposal?.selectedSections.includes(key)) {
      toast.error("A section with that name already exists.");
      return;
    }

    setAddingSection(true);
    try {
      toast.info("Generating content for new section...");
      const result = await addProposalSection(proposalId, { key, label });
      setProposal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          selectedSections: [...prev.selectedSections, key],
          sectionDisplayNames: { ...(prev.sectionDisplayNames ?? {}), [key]: label },
          sections: { ...(prev.sections ?? {}), [key]: result.content },
        };
      });
      setAddLabelValue("");
      setShowAddInput(false);
      toast.success(`"${label}" section added with AI-generated content!`);
      setActiveSection(key);
      setTimeout(() => {
        const el = document.getElementById(`section-${key}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add section.";
      toast.error(message);
    } finally {
      setAddingSection(false);
    }
  }

  // ── Approve/Reject handlers ──────────────────────────────────────────────────

  async function handleApprove(): Promise<void> {
    if (!proposal) return;
    setConfirmModal({
      isOpen: true,
      message: "Are you sure you want to approve this proposal?",
      actionType: "approve",
    });
  }

  async function handleReject(): Promise<void> {
    if (!proposal) return;
    setConfirmModal({
      isOpen: true,
      message: "Are you sure you want to reject this proposal?",
      actionType: "reject",
    });
  }

  async function handleDownload(): Promise<void> {
    setIsDownloading(true);
    try {
      const url = getDownloadUrl(proposalId);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to download proposal");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `proposal-${proposalId}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Proposal downloaded successfully");
    } catch (error) {
      toast.error("Failed to download proposal");
    } finally {
      setIsDownloading(false);
    }
  }

  async function executeApprovalAction(actionType: "approve" | "reject"): Promise<void> {
    const status = actionType === "approve" ? "approved" : "rejected";
    const setLoading = actionType === "approve" ? setIsApproving : setIsRejecting;
    const successMessage = actionType === "approve" 
      ? "Proposal approved and moved to history!" 
      : "Proposal rejected and moved to history";

    setLoading(true);
    try {
      // Update approval status via API
      await updateApprovalStatus(proposalId, status);

      // Remove from drafts via API
      try {
        const drafts = await listDrafts();
        const proposalDraft = drafts.find((d) => d.proposalId === proposalId);
        if (proposalDraft) {
          await deleteDraftApi(proposalDraft.id);
        }
      } catch (draftError) {
        console.error("Failed to remove draft:", draftError);
      }

      // Update local proposal state
      setProposal((prev) => {
        if (!prev) return prev;
        return { ...prev, approvalStatus: status };
      });

      // Update proposal store to reflect the new approval status
      updateProposalInStore(proposalId, { approvalStatus: status });
      
      // Invalidate cache to force refresh on history page
      invalidateCache();

      toast.success(successMessage);
      
      // Small delay to ensure toast is shown before redirect
      await new Promise(resolve => setTimeout(resolve, 500));
      router.push("/history");
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${actionType} proposal`;
      toast.error(message);
      throw error; // Re-throw to keep modal open on error
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const displayNames = proposal?.sectionDisplayNames ?? {};
  const sectionMetas: SectionMeta[] = (proposal?.selectedSections ?? []).map(
    (key) => ({ key, label: resolveSectionLabel(key, displayNames) })
  );

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
          <div className="proposal-actions-bar">
          {proposal && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Downloading...
                </>
              ) : (
                <>
                  <Download size={14} /> Download
                </>
              )}
            </button>
          )}
          {proposal && (!proposal.approvalStatus || proposal.approvalStatus === "pending") && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSaveDraft}
              disabled={isDownloading}
            >
              Save Draft
            </button>
          )}
          {proposal && (!proposal.approvalStatus || proposal.approvalStatus === "pending") && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleApprove}
                disabled={isApproving}
              >
                {isApproving ? "Approving..." : "Approve"}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleReject}
                disabled={isRejecting}
              >
                {isRejecting ? "Rejecting..." : "Reject"}
              </button>
            </>
          )}
          {proposal?.approvalStatus === "approved" && (
            <span className="badge badge-success">Approved</span>
          )}
          {proposal?.approvalStatus === "rejected" && (
            <span className="badge badge-danger">Rejected</span>
          )}
          </div>
        </div>

        <div className="proposal-layout">
        {/* Left sidebar */}
        <nav className="proposal-sidebar" aria-label="Proposal sections">
          <div className="proposal-sidebar-title">Sections</div>

          <ul className="proposal-sidebar-links">
            {sectionMetas.map(({ key, label }) => {
              const hasContent = Boolean(proposal?.sections?.[key]);
              const isActive = activeSection === key;
              const isRenaming = renamingKey === key;

              return (
                <li key={key}>
                  <div
                    className={`proposal-sidebar-section-row${isActive ? " active" : ""}`}
                    onClick={() => !isRenaming && handleScrollToSection(key)}
                  >
                    <span
                      className={`proposal-sidebar-dot ${hasContent ? "has-content" : "empty"}`}
                    />

                    {isRenaming ? (
                      <input
                        className="proposal-sidebar-section-edit-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(key);
                          if (e.key === "Escape") setRenamingKey(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="proposal-sidebar-section-name">
                        {label}
                      </span>
                    )}

                    {isRenaming ? (
                      <div className="proposal-sidebar-section-actions flex-center">
                        <button
                          className="proposal-sidebar-icon-btn"
                          title="Save rename"
                          onClick={(e) => { e.stopPropagation(); saveRename(key); }}
                        >
                          <Check size={11} />
                        </button>
                        <button
                          className="proposal-sidebar-icon-btn"
                          title="Cancel"
                          onClick={(e) => { e.stopPropagation(); setRenamingKey(null); }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <div className="proposal-sidebar-section-actions">
                        <button
                          className="proposal-sidebar-icon-btn"
                          title="Rename section"
                          onClick={(e) => { e.stopPropagation(); startRename(key); }}
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          className="proposal-sidebar-icon-btn danger"
                          title="Remove section"
                          onClick={(e) => { e.stopPropagation(); handleRemoveSection(key); }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Add section */}
          {showAddInput ? (
            <div className="proposal-sidebar-add-wrap">
              <input
                className="proposal-sidebar-section-edit-input w-full mb-6"
                placeholder="Section name…"
                value={addLabelValue}
                onChange={(e) => setAddLabelValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSection();
                  if (e.key === "Escape") {
                    setShowAddInput(false);
                    setAddLabelValue("");
                  }
                }}
                disabled={addingSection}
              />
              <div className="proposal-sidebar-add-actions">
                <button
                  className="btn btn-primary btn-xs"
                  onClick={handleAddSection}
                  disabled={addingSection}
                >
                  {addingSection ? "…" : "Add"}
                </button>
                <button
                  className="btn btn-ghost btn-xs-ghost"
                  onClick={() => {
                    setShowAddInput(false);
                    setAddLabelValue("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="proposal-sidebar-add-btn"
              onClick={() => setShowAddInput(true)}
            >
              <Plus size={12} />
              Add section
            </button>
          )}
        </nav>

        {/* Main content */}
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
              mermaidCode={
                DIAGRAM_SECTION_KEYS.includes(key) && proposal?.mermaidDiagram
                  ? proposal.mermaidDiagram
                  : undefined
              }
              onContentChange={handleContentChange}
              onSave={handleSaveSection}
              onRegenerate={handleRegenerate}
            />
          ))}

          {proposal?.status === "completed" &&
            sectionMetas.length > 0 &&
            sectionMetas.every((s) => !proposal.sections?.[s.key]) && (
              <div className="card empty-content-card">
                <p className="text-muted font-14">
                  No section content was generated. Please go back and try again.
                </p>
                <button
                  className="btn btn-primary mt-16"
                  onClick={() => { resetProposal(); router.push("/"); }}
                >
                  Start Over
                </button>
              </div>
            )}
          </div>
        </div>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={async () => {
          const actionType = confirmModal.actionType;
          if (actionType) {
            try {
              await executeApprovalAction(actionType);
              setConfirmModal({ isOpen: false, message: "", actionType: null });
            } catch (error) {
              // Keep modal open on error - user can retry or cancel
              console.error("Approval action failed:", error);
            }
          } else {
            setConfirmModal({ isOpen: false, message: "", actionType: null });
          }
        }}
        onCancel={() => {
          setConfirmModal({ isOpen: false, message: "", actionType: null });
        }}
      />
    </PageLayout>
  );
}
