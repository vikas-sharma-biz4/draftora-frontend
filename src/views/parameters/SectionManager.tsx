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
import { useState, useCallback } from "react";
import { Check, X, Plus, Lock } from "lucide-react";
import { toast } from "@/utils/toast";
import Button from "@/components/common/Button";
import { STATIC_SECTION_DISPLAY_NAMES, STATIC_SECTION_KEYS } from "@/constants";
import type { SectionItem } from "@/components/common/SortableSectionList";
import type { ProposalWizardData } from "@/interfaces/proposalInterfaces";
import type { SectionRecommendation } from "@/services/proposal.service";
import { logger } from "@/utils/logger";
import AddSectionModal from "@/components/modals/AddSectionModal";

const SortableSectionList = dynamic(() => import("@/components/common/SortableSectionList"), {
  ssr: false,
  loading: () => <div className="sections-ai-loading">Loading section editor…</div>,
});

type SectionManagerProposalData = Pick<
  ProposalWizardData,
  "templateId" | "sectionDisplayNames" | "contextualInstructions" | "filesMeta"
>;

interface SectionManagerProps {
  sections: SectionItem[];
  onSectionsChange: React.Dispatch<React.SetStateAction<SectionItem[]>>;
  proposalData: SectionManagerProposalData;
  onUpdateProposalData: (updates: Partial<ProposalWizardData>) => void;
  proposalId: number | null;
  onAddSection: (
    key: string,
    title: string,
    recommendation?: SectionRecommendation,
    originalIndex?: number
  ) => void;
  onRemoveFromRecommendations: (key: string) => void;
  onRemoveSectionEffect: (key: string) => void;
}

export default function SectionManager({
  sections,
  onSectionsChange,
  proposalData,
  onUpdateProposalData,
  proposalId,
  onAddSection,
  onRemoveFromRecommendations,
  onRemoveSectionEffect,
}: SectionManagerProps): JSX.Element {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string>("");

  // Add section modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [insertAfterKey, setInsertAfterKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleStartEdit = useCallback((item: SectionItem): void => {
    setEditingKey(item.key);
    setEditLabel(item.label);
  }, []);

  const handleSaveEdit = useCallback(
    (key: string): void => {
      setEditingKey((prev) => {
        const label = editLabel.trim();
        if (!label) {
          toast.error("Section name cannot be empty");
          return prev;
        }
        onSectionsChange((sections) => sections.map((s) => (s.key === key ? { ...s, label } : s)));
        return null;
      });
    },
    [editLabel, onSectionsChange]
  );

  const handleCancelEdit = useCallback((): void => {
    setEditingKey(null);
  }, []);

  const handleRemove = useCallback(
    (key: string): void => {
      onSectionsChange((prev) => {
        if (prev.length <= 1) {
          toast.error("At least one section is required");
          return prev;
        }
        return prev.filter((s) => s.key !== key);
      });
      onRemoveSectionEffect(key);
    },
    [onSectionsChange, onRemoveSectionEffect]
  );

  const handleDropFromRecommendations = useCallback(
    (sectionKey: string, sectionTitle: string): void => {
      onAddSection(sectionKey, sectionTitle);
      toast.success(`Added "${sectionTitle}" to section structure`);
      onRemoveFromRecommendations(sectionKey);
    },
    [onAddSection, onRemoveFromRecommendations]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const sectionKey = e.dataTransfer.getData("section_key");
      const sectionTitle = e.dataTransfer.getData("section_title");
      if (sectionKey && sectionTitle) {
        handleDropFromRecommendations(sectionKey, sectionTitle);
      }
    },
    [handleDropFromRecommendations]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Add section modal handlers
  const openAddModal = useCallback((afterKey?: string): void => {
    setInsertAfterKey(afterKey ?? null);
    setIsAddModalOpen(true);
  }, []);

  const closeAddModal = useCallback((): void => {
    setIsAddModalOpen(false);
    setInsertAfterKey(null);
  }, []);

  const handleAddSectionFromModal = useCallback(
    async (name: string, instructions: string): Promise<void> => {
      const key =
        "custom_" +
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
          .slice(0, 40);

      // Check for duplicates
      if (sections.some((s) => s.key === key || s.label.toLowerCase() === name.toLowerCase())) {
        toast.error("A section with this name already exists");
        return;
      }

      setIsGenerating(true);
      try {
        onSectionsChange((prev) => {
          const newSection: SectionItem = { key, label: name };
          if (insertAfterKey) {
            const idx = prev.findIndex((s) => s.key === insertAfterKey);
            if (idx >= 0) {
              const updated = [...prev];
              updated.splice(idx + 1, 0, newSection);
              return updated;
            }
          }
          return [...prev, newSection];
        });
        closeAddModal();
        toast.success(`Section "${name}" added`);
      } catch (error) {
        toast.error("Failed to add section");
      } finally {
        setIsGenerating(false);
      }
    },
    [sections, insertAfterKey, onSectionsChange, closeAddModal]
  );

  const handleAddAfter = useCallback(
    (key: string): void => {
      openAddModal(key);
    },
    [openAddModal]
  );

  return (
    <div className="mb-14">
      {/* Section Structure */}
      <div className="card">
        <div className="flex-between mb-14">
          <div className="flex-center gap-10">
            <span className="form-label mb-0">Table of Contents</span>
            <span className="badge badge-primary">{sections.length} sections</span>
          </div>
        </div>

        <div onDrop={handleDrop} onDragOver={handleDragOver} className="section-drop-zone">
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
              onAddAfter={handleAddAfter}
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
      </div>

      {/* Add Section Modal */}
      <AddSectionModal
        isOpen={isAddModalOpen}
        isGenerating={isGenerating}
        existingKeys={sections.map((s) => s.key)}
        insertAfterLabel={
          insertAfterKey ? sections.find((s) => s.key === insertAfterKey)?.label : undefined
        }
        onClose={closeAddModal}
        onSubmit={handleAddSectionFromModal}
      />
    </div>
  );
}
