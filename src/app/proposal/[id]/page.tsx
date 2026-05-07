"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProposal } from "@/context/ProposalContext";
import { Pencil, X, Check, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  getProposal,
  getDownloadUrl,
  updateSection,
  regenerateSection,
  addProposalSection,
  removeProposalSection,
  updateApprovalStatus,
} from "@/api/proposalApi";
import { SECTION_DISPLAY_NAMES, HISTORY_STORAGE_KEY, DRAFTS_STORAGE_KEY } from "@/constants";
import { DIAGRAM_SECTION_KEYS } from "@/utils/contentParser";
import type { ProposalData } from "@/types/proposal.types";
import { useSaveDraft } from "@/hooks/useSaveDraft";

const ProposalSectionEditor = dynamic(
  () => import("@/components/proposal/ProposalSectionEditor"),
  { ssr: false }
);

const ProposalSkeleton = dynamic(
  () => import("@/components/proposal/ProposalSkeleton"),
  { ssr: false }
);

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

const DynamicPipeline = dynamic(() => import("@/components/common/DynamicPipeline"), {
  ssr: false,
});

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
  const { resetProposal, setCurrentProposalId, updateProposalData, setDraftStage, setCompletedSteps, proposalData } = useProposal();
  const handleSaveDraft = useSaveDraft();
  const proposalId = Number(params.id);

  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeSection, setActiveSection] = useState<string>("");

  // Sidebar section management
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const [addLabelValue, setAddLabelValue] = useState<string>("");
  const [addingSection, setAddingSection] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProposal = useCallback(async (): Promise<void> => {
    try {
      const data = await getProposal(proposalId);
      setProposal(data);
      console.log("Proposal loaded - approvalStatus:", data.approvalStatus);
      
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

  // Auto-save to drafts when navigating away without approval/rejection
  useEffect(() => {
    function saveToDrafts(): void {
      if (!proposal || !proposal.status || proposal.status !== "completed") return;
      
      try {
        const draftItem = {
          id: proposalId.toString(),
          title: proposal.title,
          clientName: proposal.clientName,
          stage: "generated" as const,
          status: "pending_approval" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          data: proposal,
        };
        
        const drafts = JSON.parse(localStorage.getItem(DRAFTS_STORAGE_KEY) || "[]");
        const existingIndex = drafts.findIndex((d: any) => d.id === draftItem.id);
        
        if (existingIndex >= 0) {
          drafts[existingIndex] = draftItem;
        } else {
          drafts.unshift(draftItem);
        }
        
        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
      } catch (error) {
        console.error("Failed to save draft:", error);
      }
    }

    const handleBeforeUnload = (): void => {
      saveToDrafts();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      saveToDrafts();
    };
  }, [proposal, proposalId]);

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
      await addProposalSection(proposalId, { section_key: key, label, content: "" });
      setProposal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          selectedSections: [...prev.selectedSections, key],
          sectionDisplayNames: { ...(prev.sectionDisplayNames ?? {}), [key]: label },
          sections: { ...(prev.sections ?? {}), [key]: "" },
        };
      });
      setAddLabelValue("");
      setShowAddInput(false);
      toast.success(`"${label}" section added.`);
    } catch {
      toast.error("Failed to add section.");
    } finally {
      setAddingSection(false);
    }
  }

  // ── Approve/Reject handlers ──────────────────────────────────────────────────

  async function handleApprove(): Promise<void> {
    if (!proposal) return;
    setIsApproving(true);
    try {
      // Update approval status via API
      await updateApprovalStatus(proposalId, "approved");
      
      // Remove from drafts
      const drafts = JSON.parse(localStorage.getItem(DRAFTS_STORAGE_KEY) || "[]");
      const updatedDrafts = drafts.filter((d: any) => d.id !== proposalId.toString());
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updatedDrafts));
      
      toast.success("Proposal approved and moved to history!");
      router.push("/history");
    } catch (error) {
      toast.error("Failed to approve proposal");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReject(): Promise<void> {
    if (!proposal) return;
    setIsRejecting(true);
    try {
      // Update approval status via API
      await updateApprovalStatus(proposalId, "rejected");
      
      // Remove from drafts
      const drafts = JSON.parse(localStorage.getItem(DRAFTS_STORAGE_KEY) || "[]");
      const updatedDrafts = drafts.filter((d: any) => d.id !== proposalId.toString());
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updatedDrafts));
      
      toast.success("Proposal rejected and moved to history");
      router.push("/history");
    } catch (error) {
      toast.error("Failed to reject proposal");
    } finally {
      setIsRejecting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const displayNames = proposal?.sectionDisplayNames ?? {};
  const sectionMetas: SectionMeta[] = (proposal?.selectedSections ?? []).map(
    (key) => ({ key, label: resolveSectionLabel(key, displayNames) })
  );

  return (
    <div className="app-container">
      <MainSidebar />
      
      <main className="main-content no-top-padding">
        <div className="proposal-header-bar">
          <DynamicPipeline 
            currentStage="generated"
            completedSteps={[1, 2, 3]}
            visible={true}
            proposalId={proposalId}
          />
          
          <div className="proposal-actions-bar">
            {proposal && (
              <a
                href={getDownloadUrl(proposalId)}
                className="btn btn-secondary btn-sm"
                download
              >
                ⬇ Download
              </a>
            )}
            {(() => {
              console.log("Save Draft button condition check:", {
                proposal: !!proposal,
                approvalStatus: proposal?.approvalStatus,
                shouldShow: !proposal?.approvalStatus || proposal?.approvalStatus === "pending"
              });
              return proposal && (!proposal.approvalStatus || proposal.approvalStatus === "pending") && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleSaveDraft}
                >
                  Save Draft
                </button>
              );
            })()}
            <button
              className="btn btn-success btn-sm"
              onClick={handleApprove}
              disabled={isApproving || !proposal}
            >
              {isApproving ? "Approving..." : "Approve"}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleReject}
              disabled={isRejecting || !proposal}
            >
              {isRejecting ? "Rejecting..." : "Reject"}
            </button>
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
      </main>
    </div>
  );
}
