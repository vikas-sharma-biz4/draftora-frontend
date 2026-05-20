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
import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, Plus, Lock } from "lucide-react";
import { toast } from "@/utils/toast";
import Button from "@/components/common/Button";
import { STATIC_SECTION_DISPLAY_NAMES, STATIC_SECTION_KEYS } from "@/constants";
import type { SectionItem } from "@/components/common/SortableSectionList";
import SectionRecommendations, { type SectionRecommendationsRef } from "@/components/proposal/SectionRecommendations";
import type { ProposalData } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";
import AddSectionModal from "@/components/modals/AddSectionModal";

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

interface SectionManagerProps {
  sections: SectionItem[];
  onSectionsChange: React.Dispatch<React.SetStateAction<SectionItem[]>>;
  proposalData: ProposalData;
  onUpdateProposalData: (updates: Partial<ProposalData>) => void;
  isRecreateMode: boolean;
  shouldStartBackgroundFetch: boolean;
  onBackgroundFetchStarted: () => void;
}

export default function SectionManager({
  sections,
  onSectionsChange,
  proposalData,
  onUpdateProposalData,
  isRecreateMode,
  shouldStartBackgroundFetch,
  onBackgroundFetchStarted,
}: SectionManagerProps): JSX.Element {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string>("");
  const sectionRecommendationsRef = useRef<SectionRecommendationsRef>(null);

  // Add section modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [insertAfterKey, setInsertAfterKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Trigger AI recommendations background fetch when flag is set
  useEffect(() => {
    if (shouldStartBackgroundFetch && sectionRecommendationsRef.current) {
      sectionRecommendationsRef.current.startBackgroundFetch();
      onBackgroundFetchStarted();
    }
  }, [shouldStartBackgroundFetch, onBackgroundFetchStarted]);

  const handleStartEdit = useCallback((item: SectionItem): void => {
    setEditingKey(item.key);
    setEditLabel(item.label);
  }, []);

  const handleSaveEdit = useCallback((key: string): void => {
    setEditingKey((prev) => {
      const label = editLabel.trim();
      if (!label) {
        toast.error("Section name cannot be empty");
        return prev;
      }
      onSectionsChange((sections) =>
        sections.map((s) => (s.key === key ? { ...s, label } : s))
      );
      return null;
    });
  }, [editLabel, onSectionsChange]);

  const handleCancelEdit = useCallback((): void => {
    setEditingKey(null);
  }, []);

  const handleRemove = useCallback((key: string): void => {
    onSectionsChange((prev) => {
      if (prev.length <= 1) {
        toast.error("At least one section is required");
        return prev;
      }
      return prev.filter((s) => s.key !== key);
    });
  }, [onSectionsChange]);

  const addSectionToProposal = useCallback((sectionKey: string, sectionTitle: string): void => {
    logger.info('[SectionManager] Adding section to proposal', { sectionKey, sectionTitle, currentSections: sections.map(s => s.key) });

    // Check if section already exists before attempting to add
    if (sections.some(s => s.key === sectionKey)) {
      toast.error(`"${sectionTitle}" is already in the structure`);
      logger.warn('[SectionManager] Section already exists, skipping add', { sectionKey });
      return;
    }

    const newSection: SectionItem = { key: sectionKey, label: sectionTitle };
    const updatedSections = [...sections, newSection];

    logger.info('[SectionManager] Updating local sections state', {
      before: sections.map(s => s.key),
      after: updatedSections.map(s => s.key)
    });

    // Update local state first
    onSectionsChange(updatedSections);

    // Then update store
    onUpdateProposalData({
      selectedSections: updatedSections.map(s => s.key),
      sectionDisplayNames: {
        ...proposalData.sectionDisplayNames,
        [sectionKey]: sectionTitle,
      },
    });

    logger.info('[SectionManager] Section added successfully', { sectionKey, totalSections: updatedSections.length });
  }, [sections, onUpdateProposalData, proposalData.sectionDisplayNames, onSectionsChange]);

  const handleDropFromRecommendations = useCallback((sectionKey: string, sectionTitle: string): void => {
    addSectionToProposal(sectionKey, sectionTitle);
    toast.success(`Added "${sectionTitle}" to section structure`);
    sectionRecommendationsRef.current?.removeRecommendation(sectionKey);
  }, [addSectionToProposal]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const sectionKey = e.dataTransfer.getData("section_key");
    const sectionTitle = e.dataTransfer.getData("section_title");
    if (sectionKey && sectionTitle) {
      handleDropFromRecommendations(sectionKey, sectionTitle);
    }
  }, [handleDropFromRecommendations]);

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

  const handleAddSectionFromModal = useCallback(async (name: string, instructions: string): Promise<void> => {
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
  }, [sections, insertAfterKey, onSectionsChange, closeAddModal]);

  const handleAddAfter = useCallback((key: string): void => {
    openAddModal(key);
  }, [openAddModal]);

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
          onDrop={handleDrop}
          onDragOver={handleDragOver}
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

      {/* Add Section Modal */}
      <AddSectionModal
        isOpen={isAddModalOpen}
        isGenerating={isGenerating}
        existingKeys={sections.map(s => s.key)}
        insertAfterLabel={insertAfterKey ? (sections.find(s => s.key === insertAfterKey)?.label) : undefined}
        onClose={closeAddModal}
        onSubmit={handleAddSectionFromModal}
      />
    </div>
  );
}
