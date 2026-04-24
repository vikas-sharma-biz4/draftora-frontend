"use client";

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
import { SECTION_DISPLAY_NAMES } from "@/constants";
import { DIAGRAM_SECTION_KEYS } from "@/utils/contentParser";
import ProposalSectionEditor from "@/components/proposal/ProposalSectionEditor";
import ProposalSkeleton from "@/components/proposal/ProposalSkeleton";
import type { ProposalData } from "@/types/proposal.types";

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
  const proposalId = params.id ? Number(params.id) : NaN;
  const isInvalidId = isNaN(proposalId);
  const { resetProposal } = useProposal();

  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!isInvalidId);
  const [errorMessage, setErrorMessage] = useState<string>(isInvalidId ? "Invalid proposal ID. Please check the URL." : "");
  const [activeSection, setActiveSection] = useState<string>("");
  const [parentProposalId, setParentProposalId] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [localApproved, setLocalApproved] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`draftora_fp_parent_${proposalId}`);
      if (stored) setParentProposalId(Number(stored));
    } catch { /* ignore */ }
    try {
      if (localStorage.getItem(`draftora_approved_${proposalId}`) === "1") setLocalApproved(true);
    } catch { /* ignore */ }
  }, [proposalId]);

  async function handleApprove(): Promise<void> {
    setApproving(true);
    try {
      await updateApprovalStatus(proposalId, { approval_status: "approved" });
      setProposal((prev) => prev ? { ...prev, approvalStatus: "approved" } : prev);
      try {
        localStorage.setItem(`draftora_approved_${proposalId}`, "1");
        const ts = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        localStorage.setItem(`draftora_approved_at_${proposalId}`, ts);
        setLocalApproved(true);
      } catch { /* ignore */ }
      toast.success("Document approved! Next step is now unlocked.");
      try {
        const stored = localStorage.getItem(`draftora_fp_parent_${proposalId}`);
        if (stored) {
          router.push(`/proposal/${stored}/followup`);
          return;
        }
      } catch { /* ignore */ }
    } catch {
      toast.error("Failed to approve document.");
    } finally {
      setApproving(false);
    }
  }

  // Sidebar section management
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const [addLabelValue, setAddLabelValue] = useState<string>("");
  const [addingSection, setAddingSection] = useState<boolean>(false);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProposal = useCallback(async (): Promise<void> => {
    if (isNaN(proposalId)) {
      setErrorMessage("Invalid proposal ID. Please check the URL.");
      setIsLoading(false);
      return;
    }

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
        return;
      }

      if (data.status === "failed") {
        setIsLoading(false);
        setErrorMessage("Proposal generation failed. Please go back and try again.");
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        return;
      }

      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (!isNaN(proposalId)) {
        router.replace(`/generating/${proposalId}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load proposal.";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }, [proposalId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isNaN(proposalId)) {
      fetchProposal();
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchProposal, proposalId]);

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

  async function handleRegenerate(key: string, instructions?: string): Promise<string | null> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    console.log("Regenerating section:", key, "with instructions:", instructions);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const newContent = await regenerateSection(proposalId, key, instructions);
        console.log("Regenerated content for section", key, ":", newContent.substring(0, 100));
        handleContentChange(key, newContent);
        toast.success("Section regenerated.");
        return newContent;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Regeneration failed.");
        console.error(`Regeneration error for section ${key} (attempt ${attempt}/${maxRetries}):`, error);
        
        // Check if it's a network error - don't retry network errors
        if (lastError.message.includes("Failed to fetch") || lastError.message.includes("NetworkError")) {
          toast.error("Network error. Please check your connection and try again.");
          return null;
        }
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // All retries failed
    const errorMessage = lastError?.message || "Regeneration failed after multiple attempts.";
    toast.error(errorMessage);
    return null;
  }

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
    } catch (error) {
      console.error("Failed to add section:", error);
      toast.error(`Failed to add section. ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setAddingSection(false);
    }
  }



  // Determine document type from title prefix (backend returns wrong templateType)
  const isBRD = proposal?.title?.toUpperCase().startsWith("BRD -");
  const isFRD = proposal?.title?.toUpperCase().startsWith("FRD -");
  const isArchitecture = proposal?.title?.toUpperCase().startsWith("ARCHITECTURE -");
  const isSOW = proposal?.title?.toUpperCase().startsWith("SOW -");
  const isFollowUpDoc = isBRD || isFRD || isArchitecture || isSOW;

  // Transform title display format (e.g., "BRD - event" → "event-BRD")
  const getDisplayTitle = (title: string): string => {
    // Check if title matches old format "DOCUMENT_TYPE - original_title"
    const match = title.match(/^(BRD|FRD|ARCHITECTURE)\s*-\s*(.+)$/i);
    if (match) {
      const [, docType, originalTitle] = match;
      return `${originalTitle}-${docType.toUpperCase()}`;
    }
    return title;
  };


  // ── Render ───────────────────────────────────────────────────────────────────

  if (isInvalidId || errorMessage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg border p-8 max-w-md w-full">
          <h1 className="text-lg font-semibold mb-4 text-red-600">Error</h1>
          <p className="text-gray-700 mb-6">
            {errorMessage || "Invalid proposal ID. Please check the URL."}
          </p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={() => router.push("/")}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const displayNames = proposal?.sectionDisplayNames ?? {};
  const sectionMetas: SectionMeta[] = (proposal?.selectedSections ?? []).map(
    (key) => ({ key, label: resolveSectionLabel(key, displayNames) })
  );

  return (
    <div className="proposal-page-wrap">
      {/* Header */}
      <header className="proposal-header">
        <div className="proposal-header-left">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              // Clear polling timer if running
              if (pollTimerRef.current) {
                clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;
              }
              router.back();
            }}
          >
            ← Back
          </button>
          <span className="proposal-header-logo">Proposely</span>
          {proposal && (
            <>
              <span className="text-light">›</span>
              <span className="proposal-header-title">{getDisplayTitle(proposal.title)}</span>
            </>
          )}
          {proposal?.status === "completed" && (
            <span className="badge badge-success">Complete</span>
          )}
        </div>
        <div className="proposal-header-right">
          {proposal?.status === "completed" && !isFollowUpDoc && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => router.push(`/proposal/${proposalId}/followup`)}
            >
              Generate Follow-up
            </button>
          )}
          {isFollowUpDoc && proposal?.approvalStatus !== "approved" && !localApproved && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleApprove}
              disabled={approving}
              style={{ background: "#16a34a", borderColor: "#16a34a" }}
            >
              {approving ? "Approving…" : "✓ Approve"}
            </button>
          )}
          {isFollowUpDoc && (proposal?.approvalStatus === "approved" || localApproved) && (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", display: "flex", alignItems: "center", gap: 5 }}>
              ✓ Approved
            </span>
          )}
          {isFollowUpDoc && parentProposalId && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => router.push(`/proposal/${parentProposalId}/followup`)}
            >
              ← Back to Pipeline
            </button>
          )}
          {proposal && (
            <a
              href={getDownloadUrl(proposalId)}
              className="btn btn-secondary btn-sm"
              download
            >
              ⬇ Download DOCX
            </a>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { resetProposal(); router.push("/"); }}
          >
            + New Proposal
          </button>
        </div>
      </header>

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
                          disabled={isLoading || proposal?.status !== "completed"}
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          className="proposal-sidebar-icon-btn danger"
                          title="Remove section"
                          onClick={(e) => { e.stopPropagation(); handleRemoveSection(key); }}
                          disabled={isLoading || proposal?.status !== "completed"}
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
    </div>
  );
}
