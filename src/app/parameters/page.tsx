"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Target, Code, Palette, Check, X, Plus, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";

import { AI_MODEL_OPTIONS, LANGUAGE_OPTIONS, LENGTH_OPTIONS, SECTION_DISPLAY_NAMES, STATIC_SECTION_DISPLAY_NAMES, STATIC_SECTION_KEYS, TONE_OPTIONS } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import { suggestSections } from "@/api/proposalApi";
import type { SectionItem } from "@/components/common/SortableSectionList";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

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
  sectionDisplayNames: Record<string, string>
): SectionItem[] {
  return selectedSections.map((key) => ({
    key,
    label:
      sectionDisplayNames[key] ??
      SECTION_DISPLAY_NAMES[key] ??
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

export default function ParametersPage(): JSX.Element {
  const { proposalData, updateProposalData, setCurrentStep, setDraftStage, markStepCompleted } = useProposal();
  const router = useRouter();

  const [sections, setSections] = useState<SectionItem[]>(() =>
    buildSectionItems(proposalData.selectedSections, proposalData.sectionDisplayNames)
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string>("");
  const [addLabel, setAddLabel] = useState<string>("");
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const [isSuggestingAI, setIsSuggestingAI] = useState<boolean>(false);

  const fetchAISuggestions = useCallback(async (): Promise<void> => {
    if (!proposalData.title && !proposalData.description) return;
    setIsSuggestingAI(true);
    try {
      const suggested = await suggestSections({
        title: proposalData.title,
        description: proposalData.description,
        template_type: proposalData.templateType,
        context: proposalData.contextualInstructions || undefined,
      });
      const items: SectionItem[] = suggested.map((s) => ({
        key: s.key,
        label: s.label,
      }));
      setSections(items);
      const displayNames: Record<string, string> = {};
      for (const s of suggested) {
        displayNames[s.key] = s.label;
      }
      updateProposalData({
        selectedSections: items.map((s) => s.key),
        sectionDisplayNames: displayNames,
      });
      toast.success(`AI suggested ${items.length} sections for your proposal.`);
    } catch {
      toast.error("Could not fetch AI suggestions. You can add sections manually.");
    } finally {
      setIsSuggestingAI(false);
    }
  }, [proposalData.title, proposalData.description, proposalData.templateType, proposalData.contextualInstructions, updateProposalData]);

  // Sync local sections state with proposalData (e.g., after localStorage rehydration)
  useEffect(() => {
    setSections(
      buildSectionItems(proposalData.selectedSections, proposalData.sectionDisplayNames)
    );
  }, [proposalData.selectedSections, proposalData.sectionDisplayNames]);

  // Auto-suggest when coming from scratch with no sections
  useEffect(() => {
    if (
      proposalData.templateType === "scratch" &&
      proposalData.selectedSections.length === 0 &&
      (proposalData.title || proposalData.description)
    ) {
      fetchAISuggestions();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleToneSelect(value: string): void {
    updateProposalData({ tone: value });
  }

  function handleNext(): void {
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
    markStepCompleted(1);
    setDraftStage("parameters_complete");
    setCurrentStep(5);
    router.push("/review");
  }

  function handleBack(): void {
    setCurrentStep(3);
    router.push("/templates");
  }

  const currentLengthOption = LENGTH_OPTIONS.find(
    (l) => l.value === proposalData.lengthPreference
  );

  return (
    <div className="app-container">
      <MainSidebar />
      <main className="main-content">
        <DynamicPipeline 
          currentStage="wizard_in_progress"
          completedSteps={[]}
          visible={true}
        />
        <div className="page-badge">Phase 04</div>
        <h1 className="page-title">Step 4: Section Structure &amp; Tone</h1>
        <p className="page-subtitle">
          Review and refine the proposal structure. Reorder, rename, or remove
          sections — and set the tone for the generated content.
        </p>

        {/* ── Section Structure ── */}
        <div className="card mb-28">
          <div className="flex-between mb-14">
            <div className="flex-center gap-10">
              <span className="form-label mb-0">
                Section Structure
              </span>
              <span className="badge badge-primary">{sections.length} sections</span>
            </div>
            <button
              className="btn btn-secondary btn-sm flex-center gap-6"
              onClick={fetchAISuggestions}
              disabled={isSuggestingAI}
            >
              <Sparkles size={13} />
              {isSuggestingAI ? "Thinking…" : "AI Suggest"}
            </button>
          </div>

          {isSuggestingAI ? (
            <div className="sections-ai-loading">
              <div className="tmpl-spinner" aria-hidden="true" />
              AI is suggesting the best sections for your proposal…
            </div>
          ) : sections.length === 0 ? (
            <div className="ai-loading-hint">
              <div className="font-24 mb-8">✦</div>
              No sections yet. Click{" "}
              <strong>AI Suggest</strong> or add one manually below.
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

        {/* ── Tone of Voice ── */}
        <div className="mb-28">
          <div className="form-label mb-14">
            Tone of Voice
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
            <button className="btn btn-primary" onClick={handleNext}>
              Next: Review &amp; Generate →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
