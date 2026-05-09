"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Target, Code, Palette, Check, X, Plus, Lock } from "lucide-react";
import { toast } from "sonner";

import { AI_MODEL_OPTIONS, LANGUAGE_OPTIONS, LENGTH_OPTIONS, SECTION_DISPLAY_NAMES, STATIC_SECTION_DISPLAY_NAMES, STATIC_SECTION_KEYS, TONE_OPTIONS } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import type { SectionItem } from "@/components/common/SortableSectionList";
import SectionRecommendations, { type SectionRecommendationsRef } from "@/components/proposal/SectionRecommendations";
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { SaveDraftButton } from "@/components/draft/SaveDraftButton";
import { useRef } from "react";

const PageLayout = dynamic(() => import("@/components/common/PageLayout"), { ssr: false });

const DynamicPipeline = dynamic(() => import("@/components/common/DynamicPipeline"), {
  ssr: false,
});

// Heavy DnD libraries — load only when sections exist
const SortableSectionList = dynamic(
  () => import("@/components/common/SortableSectionList"),
  {
    ssr: false,
    loading: () => (
      <div className="sections-ai-loading">
        Loading section editor…
      </div>
    ),
  }
);

const TONE_ICONS = {
  professional: Briefcase,
  persuasive: Target,
  technical: Code,
  creative: Palette,
} as const;

function buildSectionItems(
  selectedSections: string[],
  sectionDisplayNames: Record<string, string>,
  originalSections?: Array<{ id: string; level?: number; parentId?: string }>
): SectionItem[] {
  return selectedSections.map((key) => {
    // Find hierarchy info from originalSections if in recreate mode
    const originalSection = originalSections?.find((s) => s.id === key);
    
    return {
      key,
      label:
        sectionDisplayNames[key] ??
        SECTION_DISPLAY_NAMES[key] ??
        key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      level: originalSection?.level,
      parentId: originalSection?.parentId,
    };
  });
}

export default function ParametersPage(): JSX.Element {
  const { 
    proposalData, 
    updateProposalData, 
    setCurrentStep, 
    setDraftStage, 
    markStepCompleted, 
    currentProposalId, 
    draftStage, 
    completedSteps,
    visitedPipelineSteps,
    syncVisitedStepsFromBackend,
    markStepVisitedOnBackend,
  } = useProposal();
  const router = useRouter();
  const handleSaveDraft = useSaveDraft();
  const isRegenerating = currentProposalId !== null;
  const isRecreateMode = proposalData.templateType === "recreate";

  // Enable auto-save to localStorage drafts when user is in pipeline stage
  useDraftAutoSave({ enabled: true });

  // Sync visited steps from backend on mount
  useEffect(() => {
    if (currentProposalId) {
      syncVisitedStepsFromBackend(currentProposalId);
    }
  }, [currentProposalId, syncVisitedStepsFromBackend]);

  const [sections, setSections] = useState<SectionItem[]>(() =>
    buildSectionItems(
      proposalData.selectedSections, 
      proposalData.sectionDisplayNames,
      proposalData.originalSections
    )
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string>("");
  const [addLabel, setAddLabel] = useState<string>("");
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const sectionRecommendationsRef = useRef<SectionRecommendationsRef>(null);

  // Sync local sections state with proposalData (e.g., after localStorage rehydration)
  useEffect(() => {
    setSections(
      buildSectionItems(
        proposalData.selectedSections, 
        proposalData.sectionDisplayNames,
        proposalData.originalSections
      )
    );
  }, [proposalData.selectedSections, proposalData.sectionDisplayNames, proposalData.originalSections]);

  // Mark step 1 as visited when this page loads
  useEffect(() => {
    markStepCompleted(1);
  }, [markStepCompleted]);

  // Restore scroll position from draft UI state
  useEffect(() => {
    try {
      const uiStateStr = sessionStorage.getItem("draft_ui_state");
      if (uiStateStr) {
        const uiState = JSON.parse(uiStateStr);
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
  }, []);

  function handleStartEdit(item: SectionItem): void {
    setEditingKey(item.key);
    setEditLabel(item.label);
  }

  function handleSaveEdit(key: string): void {
    const label = editLabel.trim();
    if (!label) {
      toast.error("Section name cannot be empty.");
      return;
    }
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, label } : s))
    );
    setEditingKey(null);
  }

  function handleCancelEdit(): void {
    setEditingKey(null);
  }

  function handleRemove(key: string): void {
    if (sections.length <= 1) {
      toast.error("At least one section is required.");
      return;
    }
    setSections((prev) => prev.filter((s) => s.key !== key));
  }

  function handleAddSection(): void {
    const label = addLabel.trim();
    if (!label) return;
    const key =
      "custom_" +
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40);
    if (sections.some((s) => s.key === key)) {
      toast.error("A section with this name already exists.");
      return;
    }
    setSections((prev) => [...prev, { key, label }]);
    setAddLabel("");
    setShowAddInput(false);
  }

  function handleSectionAddedFromRecommendations(sectionKey: string): void {
    // This callback is triggered when a section is added from recommendations
    // The SectionRecommendations component handles its own state removal
    // This can be used for additional tracking if needed
  }

  function handleToneSelect(value: string): void {
    updateProposalData({ tone: value });
  }

  async function handleNext(): Promise<void> {
    if (sections.length === 0) {
      toast.error("Please add at least one section.");
      return;
    }
    const keys = sections.map((s) => s.key);
    const displayNames: Record<string, string> = {};
    for (const s of sections) {
      displayNames[s.key] = s.label;
    }
    updateProposalData({
      selectedSections: keys,
      sectionDisplayNames: displayNames,
      customSections: [],
    });
    
    // Mark Step 1 as visited when proceeding to Review
    if (currentProposalId) {
      await markStepVisitedOnBackend(currentProposalId, 1);
    }
    
    markStepCompleted(1);
    setDraftStage("parameters_complete");
    setCurrentStep(5);
    router.push("/review");
    
    if (isRegenerating) {
      toast.info("Parameters updated. Review and regenerate to apply changes.");
    }
  }

  function handleBack(): void {
    setCurrentStep(1);
    router.push("/");
  }

  const currentLengthOption = LENGTH_OPTIONS.find(
    (l) => l.value === proposalData.lengthPreference
  );

  return (
    <PageLayout noPadding>
        <DynamicPipeline 
          currentStage={draftStage}
          completedSteps={completedSteps}
          visitedSteps={visitedPipelineSteps}
          visible={true}
          proposalId={currentProposalId}
        />
        <div className="page-badge">Phase 04</div>
        <h1 className="page-title">Step 4: Table of Contents &amp; Parameters</h1>
        <p className="page-subtitle">
          {isRecreateMode
            ? "Sections extracted from your document are shown below. Reorder, rename, or add sections — each will be rewritten with the new context."
            : "Review and refine the proposal structure. Reorder, rename, or remove sections — and set the tone for the generated content."}
        </p>

        {isRecreateMode && (
          <div className="recreate-banner">
            <div>
              <strong>Recreate Mode</strong>
              {proposalData.exactDocumentName && (
                <span className="recreate-banner-file"> · {proposalData.exactDocumentName}</span>
              )}
              <div className="recreate-banner-hint">
                {proposalData.originalSections?.length ?? 0} sections will be rewritten using new context.
              </div>
            </div>
          </div>
        )}

        {/* ── Section Structure with AI Recommendations ── */}
        <div className="parameters-layout mb-28">
          {/* Left Column: Section Structure */}
          <div className="card">
            <div className="flex-between mb-14">
              <div className="flex-center gap-10">
                <span className="form-label mb-0">
                  Table of Contents
                </span>
                <span className="badge badge-primary">{sections.length} sections</span>
              </div>
            </div>

          <div
            onDrop={(e) => {
              e.preventDefault();
              const sectionKey = e.dataTransfer.getData("section_key");
              const sectionTitle = e.dataTransfer.getData("section_title");
              
              if (sectionKey && sectionTitle) {
                // Check if section already exists
                if (sections.some(s => s.key === sectionKey)) {
                  toast.error(`"${sectionTitle}" is already in the structure`);
                  return;
                }
                
                const newSection: SectionItem = {
                  key: sectionKey,
                  label: sectionTitle,
                };
                setSections([...sections, newSection]);
                updateProposalData({
                  selectedSections: [...sections.map(s => s.key), sectionKey],
                  sectionDisplayNames: {
                    ...proposalData.sectionDisplayNames,
                    [sectionKey]: sectionTitle,
                  },
                });
                toast.success(`Added "${sectionTitle}" to section structure`);
                
                // Remove from recommendations list
                sectionRecommendationsRef.current?.removeRecommendation(sectionKey);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            className="section-drop-zone"
          >
            {sections.length === 0 ? (
              <div className="ai-loading-hint">
                <div className="font-24 mb-8">✦</div>
                No sections yet. Add one manually below or drag from recommendations.
              </div>
            ) : (
              <SortableSectionList
                sections={sections}
                editingKey={editingKey}
                editLabel={editLabel}
                onSectionsChange={setSections}
                onStartEdit={handleStartEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onRemove={handleRemove}
                onEditLabelChange={setEditLabel}
              />
            )}
          </div>
        

          {/* Always Included — static sections (read-only) */}
          <div className="static-sections-panel">
            <div className="static-sections-header">
              <Lock size={11} />
              <span>Always Included</span>
              <span className="static-sections-hint">appended automatically — not AI-generated</span>
            </div>
            <ul className="static-sections-list">
              {STATIC_SECTION_KEYS.map((key, i) => (
                <li key={key} className="static-sections-item">
                  <span className="static-sections-num">{sections.length + i + 1}</span>
                  <span className="static-sections-name">{STATIC_SECTION_DISPLAY_NAMES[key]}</span>
                  <Lock size={10} className="static-sections-lock" />
                </li>
              ))}
            </ul>
          </div>

          {/* Add section row */}
          {showAddInput ? (
            <div className="section-add-row">
              <input
                className="section-add-input"
                placeholder="Section name, e.g. Pricing & Payment Terms"
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSection();
                  if (e.key === "Escape") {
                    setShowAddInput(false);
                    setAddLabel("");
                  }
                }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddSection}>
                <Check size={13} />
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setShowAddInput(false);
                  setAddLabel("");
                }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm mt-10 flex-center gap-6"
              onClick={() => setShowAddInput(true)}
            >
              <Plus size={13} />
              Add Section
            </button>
          )}
          </div>

          {/* Right Column: AI Recommendations */}
          <SectionRecommendations
            ref={sectionRecommendationsRef}
            templateId={proposalData.templateId}
            existingSections={sections.map(s => s.key)}
            context={
              isRecreateMode
                ? proposalData.contextualInstructions || ""
                : proposalData.contextualInstructions || ""
            }
            documentContext={
              isRecreateMode
                ? (proposalData.exactDocumentName ?? "") +
                  (proposalData.filesMeta?.length
                    ? ", " + proposalData.filesMeta.map((f) => f.name).join(", ")
                    : "")
                : proposalData.filesMeta?.map((f) => f.name).join(", ") || ""
            }
            onAddSection={(sectionKey, title) => {
              const newSection: SectionItem = {
                key: sectionKey,
                label: title,
              };
              setSections([...sections, newSection]);
              updateProposalData({
                selectedSections: [...sections.map(s => s.key), sectionKey],
                sectionDisplayNames: {
                  ...proposalData.sectionDisplayNames,
                  [sectionKey]: title,
                },
              });
            }}
            onSectionAdded={handleSectionAddedFromRecommendations}
          />
        </div>

        {/* ── Tone of Voice ── */}
        <div className="mb-28">
          <div className="form-label mb-14">
            Parameters
          </div>
          <div className="tone-grid">
            {TONE_OPTIONS.map(({ value, label, description }) => {
              const Icon = TONE_ICONS[value as keyof typeof TONE_ICONS];
              const isSelected = proposalData.tone === value;
              return (
                <div
                  key={value}
                  className={`tone-card${isSelected ? " selected" : ""}`}
                  onClick={() => handleToneSelect(value)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleToneSelect(value);
                  }}
                >
                  <div className="tone-card-icon">
                    <Icon size={18} />
                  </div>
                  <div className="tone-card-label">
                    {label}
                    {isSelected && <span className="tone-check">✓</span>}
                  </div>
                  <div className="tone-card-desc">{description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Length Selection + Language ── */}
        <div className="grid-2 mb-32">
          <div className="card">
            <div className="form-label mb-14">
              Proposal Length
            </div>
            <div className="flex-col gap-8">
              {LENGTH_OPTIONS.map(({ value, label, description }) => {
                const isSelected = proposalData.lengthPreference === value;
                return (
                  <div
                    key={value}
                    className={`length-option${isSelected ? " selected" : ""}`}
                    onClick={() => updateProposalData({ lengthPreference: value })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateProposalData({ lengthPreference: value });
                    }}
                  >
                    <div className="flex-between">
                      <span className="length-option-label">{label}</span>
                      {isSelected && <span className="tone-check">✓</span>}
                    </div>
                    <span className="length-option-desc">{description}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="form-label mb-14">
              Language &amp; Locale
            </div>
            <select
              className="form-select"
              value={proposalData.language}
              onChange={(e) => updateProposalData({ language: e.target.value })}
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── AI Model selector ── */}
        <div className="card mb-32">
          <div className="form-label mb-14">
            AI Model
          </div>
          <div className="grid-2">
            {AI_MODEL_OPTIONS.map(({ value, label, provider, description }) => {
              const isSelected = (proposalData.aiModel ?? "gpt-4o") === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`tone-card${isSelected ? " selected" : ""}`}
                  onClick={() => updateProposalData({ aiModel: value })}
                >
                  <div className="tone-card-icon">✦</div>
                  <div className="tone-card-label">
                    {label}
                    <span className="font-11 text-muted ml-6">({provider})</span>
                    {isSelected && <span className="tone-check">✓</span>}
                  </div>
                  <div className="tone-card-desc">{description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="page-footer">
          <div className="page-footer-left">
            <button className="btn btn-ghost" onClick={handleBack}>
              ← Back
            </button>
          </div>
          <div className="page-footer-right">
            <button className="btn btn-secondary" onClick={handleSaveDraft}>
              Save Draft
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Next: Review &amp; Generate →
            </button>
          </div>
        </div>
    </PageLayout>
  );
}
