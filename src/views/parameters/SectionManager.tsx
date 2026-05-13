/**
 * SectionManager component
 *
 * Manages the table of contents section list:
 * - Drag-and-drop from AI recommendations
 * - Sortable section list with inline editing
 * - Static "Always Included" sections (read-only)
 * - Add section form
 */

"use client";

import dynamic from "next/dynamic";
import { useState, useRef } from "react";
import { Check, X, Plus, Lock } from "lucide-react";
import { toast } from "@/utils/toast";
import Button from "@/components/common/Button";
import { STATIC_SECTION_DISPLAY_NAMES, STATIC_SECTION_KEYS } from "@/constants";
import type { SectionItem } from "@/components/common/SortableSectionList";
import SectionRecommendations, { type SectionRecommendationsRef } from "@/components/proposal/SectionRecommendations";
import type { ProposalData } from "@/interfaces/proposalInterfaces";

const SortableSectionList = dynamic(
  () => import("@/components/common/SortableSectionList"),
  {
    ssr: false,
    loading: () => {
      const { SortableSectionListSkeleton } = require("@/components/common/SortableSectionList");
      return <SortableSectionListSkeleton />;
    },
  }
);

interface SectionManagerProps {
  sections: SectionItem[];
  onSectionsChange: React.Dispatch<React.SetStateAction<SectionItem[]>>;
  proposalData: ProposalData;
  onUpdateProposalData: (updates: Partial<ProposalData>) => void;
  isRecreateMode: boolean;
}

export default function SectionManager({
  sections,
  onSectionsChange,
  proposalData,
  onUpdateProposalData,
  isRecreateMode,
}: SectionManagerProps): JSX.Element {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string>("");
  const [addLabel, setAddLabel] = useState<string>("");
  const [showAddInput, setShowAddInput] = useState<boolean>(false);
  const sectionRecommendationsRef = useRef<SectionRecommendationsRef>(null);

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
    onSectionsChange((prev) =>
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
    onSectionsChange((prev) => prev.filter((s) => s.key !== key));
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
    onSectionsChange((prev) => [...prev, { key, label }]);
    setAddLabel("");
    setShowAddInput(false);
  }

  function addSectionToProposal(sectionKey: string, sectionTitle: string): void {
    if (sections.some(s => s.key === sectionKey)) {
      toast.error(`"${sectionTitle}" is already in the structure`);
      return;
    }

    const newSection: SectionItem = { key: sectionKey, label: sectionTitle };
    onSectionsChange([...sections, newSection]);
    onUpdateProposalData({
      selectedSections: [...sections.map(s => s.key), sectionKey],
      sectionDisplayNames: {
        ...proposalData.sectionDisplayNames,
        [sectionKey]: sectionTitle,
      },
    });
  }

  function handleDropFromRecommendations(sectionKey: string, sectionTitle: string): void {
    addSectionToProposal(sectionKey, sectionTitle);
    toast.success(`Added "${sectionTitle}" to section structure`);
    sectionRecommendationsRef.current?.removeRecommendation(sectionKey);
  }

  return (
    <div className="parameters-layout mb-14">
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
              handleDropFromRecommendations(sectionKey, sectionTitle);
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
              onSectionsChange={onSectionsChange}
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
            <Button variant="primary" size="sm" onClick={handleAddSection}>
              <Check size={13} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddInput(false);
                setAddLabel("");
              }}
            >
              <X size={13} />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddInput(true)}
            className="mt-10 flex-center gap-6"
          >
            <Plus size={13} />
            Add Section
          </Button>
        )}
      </div>

      {/* Right Column: AI Recommendations */}
      <SectionRecommendations
        ref={sectionRecommendationsRef}
        templateId={proposalData.templateId}
        existingSections={sections.map(s => s.key)}
        context={proposalData.contextualInstructions || ""}
        documentContext={
          (isRecreateMode ? (proposalData.exactDocumentName ? proposalData.exactDocumentName + ", " : "") : "") +
          (proposalData.filesMeta?.map((f) => f.name).join(", ") ?? "")
        }
        onAddSection={addSectionToProposal}
      />
    </div>
  );
}
