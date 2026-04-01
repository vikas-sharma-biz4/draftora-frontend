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
  const { resetProposal } = useProposal();
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

  function handleScrollToSection(key: string): void {
    setActiveSection(key);
    const el = document.getElementById(`section-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleContentChange(key: string, html: string): void {
    setProposal((prev) => {
      if (!prev) return prev;
      return { ...prev, sections: { ...(prev.sections ?? {}), [key]: html } };
    });
  }

  async function handleSaveSection(key: string, content: string): Promise<void> {
    try {
      await updateSection(proposalId, key, content);
      toast.success("Section saved.");
    } catch {
      toast.error("Failed to save section.");
    }
  }

  async function handleRegenerate(key: string, instructions?: string): Promise<string | null> {
    try {
      const newContent = await regenerateSection(proposalId, key, instructions);
      handleContentChange(key, newContent);
      toast.success("Section regenerated.");
      return newContent;
    } catch {
      toast.error("Regeneration failed.");
      return null;
    }
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
    } catch {
      toast.error("Failed to add section.");
    } finally {
      setAddingSection(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const displayNames = proposal?.sectionDisplayNames ?? {};
  const sectionMetas: SectionMeta[] = (proposal?.selectedSections ?? []).map(
    (key) => ({ key, label: resolveSectionLabel(key, displayNames) })
  );

  return (
    <div className="proposal-page-wrap">
      {/* Header */}
      <header className="proposal-header">
        <div className="proposal-header-left">
          <span className="proposal-header-logo">Proposely</span>
          {proposal && (
            <>
              <span className="text-light">›</span>
              <span className="proposal-header-title">{proposal.title}</span>
            </>
          )}
          {proposal?.status === "completed" && (
            <span className="badge badge-success">Complete</span>
          )}
        </div>
        <div className="proposal-header-right">
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
    </div>
  );
}
