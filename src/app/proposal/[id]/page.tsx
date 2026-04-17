"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, X, Check, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  getProposal,
  getDownloadUrl,
  updateSection,
  regenerateSection,
  addProposalSection,
  removeProposalSection,
  generateFollowUpDocument,
  generateProposal,
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

  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!isInvalidId);
  const [errorMessage, setErrorMessage] = useState<string>(isInvalidId ? "Invalid proposal ID. Please check the URL." : "");
  const [activeSection, setActiveSection] = useState<string>("");

  // Sidebar section management
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const [addLabelValue, setAddLabelValue] = useState<string>("");
  const [addingSection, setAddingSection] = useState<boolean>(false);
  const [generatingDocument, setGeneratingDocument] = useState<"brd" | "frd" | "architecture" | null>(null);

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
    } catch (error) {
      console.error("Failed to add section:", error);
      toast.error(`Failed to add section. ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setAddingSection(false);
    }
  }

  async function handleGenerateFollowUp(documentType: "brd" | "frd" | "architecture"): Promise<void> {
    // Determine document type from title prefix (backend returns wrong templateType)
    const isCurrentBRD = proposal?.title?.toUpperCase().startsWith("BRD -");
    const isCurrentFRD = proposal?.title?.toUpperCase().startsWith("FRD -");
    const isCurrentArchitecture = proposal?.title?.toUpperCase().startsWith("ARCHITECTURE -");

    if (!proposal || !proposal.id) {
      toast.error("Invalid proposal. Cannot generate follow-up document.");
      return;
    }

    // Validate workflow: BRD from pre-sale, FRD from BRD, Architecture from FRD
    if (documentType === "brd") {
      // BRD can be generated from any pre-sale proposal (mvp, poc, design)
      if (!["mvp", "poc", "design", "scratch", "predefined"].includes(proposal.templateType) &&
          !(proposal.templateId && proposal.templateType === "custom")) {
        toast.error("BRD can only be generated from a pre-sale proposal.");
        return;
      }
    } else if (documentType === "frd") {
      // FRD must be generated from BRD
      if (!isCurrentBRD && proposal.templateType !== "brd") {
        toast.error("FRD can only be generated from an approved BRD.");
        return;
      }
    } else if (documentType === "architecture") {
      // Architecture must be generated from FRD
      if (!isCurrentFRD && proposal.templateType !== "frd") {
        toast.error("Architecture can only be generated from an approved FRD.");
        return;
      }
    }

    setGeneratingDocument(documentType);
    try {
      const result = await generateFollowUpDocument(proposal.id, {
        document_type: documentType,
      });

      // Handle case where backend returns document content directly
      if (result.document_content) {
        // Create a new proposal from the generated content
        try {
          const newProposalData: ProposalData = {
            title: `${documentType.toUpperCase()} - ${proposal.title}`,
            clientName: proposal.clientName,
            description: `Generated ${documentType.toUpperCase()} from proposal: ${proposal.title}`,
            tone: proposal.tone,
            lengthPreference: proposal.lengthPreference,
            language: proposal.language,
            selectedSections: getSectionsForDocumentType(documentType),
            sectionDisplayNames: {},
            customSections: [],
            contextualInstructions: "",
            webReferences: [],
            files: [],
            templateId: null,
            templateType: documentType,
            approvalStatus: "pending",
          };

          const createResult = await generateProposal(newProposalData);

          // Note: Section updates are skipped due to backend endpoint issues
          // The proposal is created with correct sections selected
          // User can regenerate sections if needed
          toast.success(`${documentType.toUpperCase()} proposal created successfully! Redirecting...`);
          await router.push(`/proposal/${createResult.id}`);
        } catch (createError) {
          console.error("Failed to create proposal from content:", createError);
          toast.error("Failed to create proposal from generated content.");
        }

        setGeneratingDocument(null);
        return;
      }

      // Handle case where backend returns a new proposal ID
      if (result.id && !isNaN(result.id)) {
        toast.success(`${documentType.toUpperCase()} generation started. Redirecting...`);
        await router.push(`/generating/${result.id}`);
        return;
      }

      // Neither content nor ID returned
      toast.error("Backend returned invalid response. Please try again.");
      setGeneratingDocument(null);
    } catch (error) {
      console.error("Follow-up generation error:", error);
      const errorMessage = error instanceof Error ? error.message : `Failed to generate ${documentType.toUpperCase()}`;
      if (errorMessage.includes("405") || errorMessage.includes("Method Not Allowed")) {
        toast.error("Follow-up document generation is not available yet. Backend endpoint not implemented.");
      } else {
        toast.error(errorMessage);
      }
      setGeneratingDocument(null);
    }
  }

  function getSectionsForDocumentType(documentType: string): string[] {
    switch (documentType) {
      case "brd":
        return [
          "brd_document_control",
          "brd_executive_overview",
          "brd_business_objectives",
          "brd_stakeholder_register",
          "brd_current_state",
          "brd_future_state",
          "brd_scope_definition",
          "brd_business_requirements",
          "brd_business_kpis",
          "brd_user_roles",
          "brd_business_process_flows",
          "brd_data_requirements",
          "brd_integration_requirements",
          "brd_compliance",
          "brd_assumptions_constraints",
          "brd_acceptance_criteria",
          "brd_risk_mitigation",
          "brd_glossary",
          "brd_open_issues",
        ];
      case "frd":
        return [
          "frd_document_control",
          "frd_system_overview",
          "frd_system_modules",
          "frd_functional_requirements",
          "frd_auth_authz",
          "frd_integrations",
          "frd_data_management",
          "frd_reporting",
          "frd_search_filter",
          "frd_file_handling",
          "frd_error_handling",
          "frd_non_functional",
          "frd_constraints",
          "frd_traceability",
          "frd_open_items",
        ];
      case "architecture":
        return [
          "arch_document_control",
          "arch_overview",
          "arch_context",
          "arch_container",
          "arch_component",
          "arch_data",
          "arch_api",
          "arch_auth_authz",
          "arch_integration",
          "arch_infrastructure",
          "arch_security",
          "arch_performance",
          "arch_observability",
          "arch_cicd",
          "arch_disaster_recovery",
          "arch_adr",
          "arch_technical_debt",
        ];
      default:
        return [];
    }
  }

  function parseMarkdownToSections(markdown: string, documentType: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionKeys = getSectionsForDocumentType(documentType);
    
    // Simple parsing: split by ## headers and map to section keys
    const lines = markdown.split('\n');
    let currentSection: string | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        
        // Start new section
        const header = line.replace('## ', '').trim().toLowerCase();
        // Try to match header to section key
        const matchedKey = sectionKeys.find(key => header.includes(key.replace(/^(brd_|frd_|arch_)/, '')));
        currentSection = matchedKey || header;
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }

  async function handleUpdateApprovalStatus(status: "approved" | "rejected"): Promise<void> {
    if (!proposal) return;

    // Update approval status locally (backend endpoint not implemented yet)
    setProposal((prev) => prev ? { ...prev, approvalStatus: status } : null);
    toast.success(status === "approved" ? "Document approved." : "Document rejected.");
  }

  async function handleRegenerateDocument(): Promise<void> {
    if (!proposal || !proposal.id) {
      toast.error("Invalid proposal. Cannot regenerate document.");
      return;
    }

    // Determine current document type from title
    const isCurrentBRD = proposal?.title?.toUpperCase().startsWith("BRD -");
    const isCurrentFRD = proposal?.title?.toUpperCase().startsWith("FRD -");
    const isCurrentArchitecture = proposal?.title?.toUpperCase().startsWith("ARCHITECTURE -");

    if (!isCurrentBRD && !isCurrentFRD && !isCurrentArchitecture) {
      toast.error("Regeneration is only available for BRD, FRD, and Architecture documents.");
      return;
    }

    // Determine document type
    let documentType: "brd" | "frd" | "architecture";
    if (isCurrentBRD) {
      documentType = "brd";
    } else if (isCurrentFRD) {
      documentType = "frd";
    } else {
      documentType = "architecture";
    }

    // Find the parent proposal (the one this was generated from)
    // For now, we'll regenerate from the current proposal's data
    // In a real implementation, you'd need to track the parent proposal ID

    setGeneratingDocument(documentType);
    try {
      const result = await generateFollowUpDocument(proposal.id, {
        document_type: documentType,
      });

      if (result.document_content) {
        // Parse the markdown content and update sections
        const sections = parseMarkdownToSections(result.document_content, documentType);

        // Update each section with the parsed content
        for (const [key, content] of Object.entries(sections)) {
          try {
            await updateSection(proposal.id, key, content as string);
          } catch (sectionError) {
            console.error(`Failed to update section ${key}:`, sectionError);
          }
        }

        // Reset approval status to pending after regeneration
        setProposal((prev) => prev ? { ...prev, approvalStatus: "pending" } : null);
        toast.success(`${documentType.toUpperCase()} content updated successfully!`);
      } else if (result.id && !isNaN(result.id)) {
        // If backend returns a new ID, redirect to it
        toast.success(`${documentType.toUpperCase()} regeneration started. Redirecting...`);
        router.push(`/generating/${result.id}`);
      } else {
        toast.error("Backend returned invalid response. Please try again.");
      }
    } catch (error) {
      console.error("Regeneration error:", error);
      const errorMessage = error instanceof Error ? error.message : `Failed to regenerate ${documentType.toUpperCase()}`;
      toast.error(errorMessage);
    } finally {
      setGeneratingDocument(null);
    }
  }

  // Determine document type from title prefix (backend returns wrong templateType)
  const isBRD = proposal?.title?.toUpperCase().startsWith("BRD -");
  const isFRD = proposal?.title?.toUpperCase().startsWith("FRD -");
  const isArchitecture = proposal?.title?.toUpperCase().startsWith("ARCHITECTURE -");

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

  // Determine which follow-up documents can be generated
  const canGenerateBRD = proposal?.status === "completed" && 
    !isBRD && !isFRD && !isArchitecture &&
    (["mvp", "poc", "design", "scratch", "predefined"].includes(proposal.templateType) || 
     (proposal.templateId && proposal.templateType === "custom"));
  const canGenerateFRD = proposal?.status === "completed" && 
    proposal.approvalStatus === "approved" &&
    (isBRD || proposal.templateType === "brd" || proposal.templateId === "brd-document");
  const canGenerateArchitecture = proposal?.status === "completed" && 
    proposal.approvalStatus === "approved" &&
    (isFRD || proposal.templateType === "frd" || proposal.templateId === "frd-document");

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
          {proposal?.status === "completed" && (
            <>
              {/* Approval buttons for BRD and FRD documents */}
              {(isBRD || isFRD || proposal.templateType === "brd" || proposal.templateId === "brd-document" ||
                proposal.templateType === "frd" || proposal.templateId === "frd-document") && (
                <>
                  {(proposal.approvalStatus === "pending" || !proposal.approvalStatus) && (
                    <>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleUpdateApprovalStatus("approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleUpdateApprovalStatus("rejected")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {proposal.approvalStatus === "approved" && (
                    <>
                      <span className="badge badge-success">Approved</span>
                      {isBRD && canGenerateFRD && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleGenerateFollowUp("frd")}
                          disabled={generatingDocument !== null}
                        >
                          {generatingDocument === "frd" ? "Generating FRD..." : "Generate FRD"}
                        </button>
                      )}
                      {isFRD && canGenerateArchitecture && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleGenerateFollowUp("architecture")}
                          disabled={generatingDocument !== null}
                        >
                          {generatingDocument === "architecture" ? "Generating Architecture..." : "Generate Architecture"}
                        </button>
                      )}
                    </>
                  )}
                  {proposal.approvalStatus === "rejected" && (
                    <>
                      <span className="badge badge-danger">Rejected</span>
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => handleRegenerateDocument()}
                        disabled={generatingDocument !== null}
                      >
                        {generatingDocument ? "Regenerating..." : "Regenerate"}
                      </button>
                    </>
                  )}
                </>
              )}
              {canGenerateBRD && !isBRD && !isFRD && !isArchitecture && proposal.approvalStatus !== "rejected" && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleGenerateFollowUp("brd")}
                  disabled={generatingDocument !== null}
                >
                  {generatingDocument === "brd" ? "Generating BRD..." : "Generate BRD"}
                </button>
              )}
              {generatingDocument && (
                <div className="flex flex-col items-center gap-2 mt-2">
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 animate-pulse w-full" />
                  </div>
                  <span className="text-xs text-gray-600">Generating {generatingDocument.toUpperCase()}...</span>
                </div>
              )}
            </>
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
            onClick={() => router.push("/")}
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
                          disabled={isLoading || proposal?.status !== "completed" || generatingDocument !== null}
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          className="proposal-sidebar-icon-btn danger"
                          title="Remove section"
                          onClick={(e) => { e.stopPropagation(); handleRemoveSection(key); }}
                          disabled={isLoading || proposal?.status !== "completed" || generatingDocument !== null}
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
                  onClick={() => router.push("/")}
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
