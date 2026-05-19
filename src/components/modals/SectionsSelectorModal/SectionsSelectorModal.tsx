"use client";

import React, { useState, useMemo } from "react";
import { X, Search, AlertCircle, Plus } from "lucide-react";
import { toast } from "@/utils/toast";

import styles from "../EditModal.module.scss";
import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { SECTION_DISPLAY_NAMES, STATIC_SECTION_DISPLAY_NAMES } from "@/constants";

interface SectionsSelectorModalProps {
  selectedSections: string[];
  sectionDisplayNames: Record<string, string>;
  onClose: () => void;
  onSave: (sections: string[]) => void;
}

const SECTION_CATEGORIES: Record<string, { label: string; sections: string[] }> = {
  core: {
    label: "Core Sections",
    sections: [
      "introduction",
      "purpose",
      "executive_summary",
      "project_understanding",
      "proposed_solution",
    ],
  },
  technical: {
    label: "Technical",
    sections: [
      "high_level_scope",
      "high_level_feature_list",
      "non_functional_requirements",
      "proposed_technology_stack",
      "system_architecture",
      "user_flow",
    ],
  },
  planning: {
    label: "Planning & Timeline",
    sections: [
      "milestone_timeline",
      "implementation_plan",
      "timeline",
      "client_dependencies",
      "communication_client_cadence",
    ],
  },
  risk: {
    label: "Risk & Operations",
    sections: ["risks_assumptions"],
  },
  company: {
    label: "Company Info",
    sections: ["similar_projects", "our_approach_methodology"],
  },
  static: {
    label: "Static Sections",
    sections: [
      "trusted_advisors",
      "our_trusted_clients",
      "why_choose_us",
      "brain_behind_development",
    ],
  },
};

const ALL_CATEGORIZED_SECTIONS = new Set(
  Object.values(SECTION_CATEGORIES).flatMap((c) => c.sections)
);

export default function SectionsSelectorModal({
  selectedSections,
  sectionDisplayNames,
  onClose,
  onSave,
}: SectionsSelectorModalProps): JSX.Element | null {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedSections));
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set([...Object.keys(SECTION_CATEGORIES), "other"])
  );
  const [customSections, setCustomSections] = useState<Record<string, string>>({});
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [customSectionName, setCustomSectionName] = useState<string>("");

  const allDisplayNames = useMemo(
    () => ({ ...SECTION_DISPLAY_NAMES, ...STATIC_SECTION_DISPLAY_NAMES, ...sectionDisplayNames, ...customSections }),
    [sectionDisplayNames, customSections]
  );

  const uncategorizedSections = useMemo(() => {
    const allCustomKeys = Object.keys(customSections);
    const allUncategorized = [...selectedSections.filter((s) => !ALL_CATEGORIZED_SECTIONS.has(s)), ...allCustomKeys];
    return Array.from(new Set(allUncategorized));
  }, [selectedSections, customSections]);

  const categoriesToRender = useMemo(() => {
    if (uncategorizedSections.length === 0) return SECTION_CATEGORIES;
    return {
      ...SECTION_CATEGORIES,
      other: { label: "Other Sections", sections: uncategorizedSections },
    };
  }, [uncategorizedSections]);

  const totalSections = useMemo(() => {
    const all = new Set([
      ...Object.values(SECTION_CATEGORIES).flatMap((c) => c.sections),
      ...uncategorizedSections,
    ]);
    return all.size;
  }, [uncategorizedSections]);

  function getDisplayName(sectionKey: string): string {
    return (
      allDisplayNames[sectionKey] ||
      sectionKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  function toggleSection(sectionKey: string): void {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  }

  function toggleCategory(categoryKey: string): void {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryKey)) {
        newSet.delete(categoryKey);
      } else {
        newSet.add(categoryKey);
      }
      return newSet;
    });
  }

  function selectAllCore(): void {
    setSelected((prev) => {
      const newSet = new Set(prev);
      SECTION_CATEGORIES.core.sections.forEach((s) => newSet.add(s));
      return newSet;
    });
  }

  function deselectAll(): void {
    setSelected(new Set());
  }

  function handleAddCustomSection(): void {
    const trimmedName = customSectionName.trim();
    if (!trimmedName) {
      toast.error("Section name cannot be empty");
      return;
    }

    const sectionKey = trimmedName.toLowerCase().replace(/\s+/g, "_");
    
    if (allDisplayNames[sectionKey]) {
      toast.error("A section with this name already exists");
      return;
    }

    setCustomSections((prev) => ({ ...prev, [sectionKey]: trimmedName }));
    setSelected((prev) => new Set([...Array.from(prev), sectionKey]));
    setCustomSectionName("");
    setShowAddCustom(false);
    toast.success(`Custom section "${trimmedName}" added`);
  }

  function handleSave(): void {
    if (selected.size < 3) {
      toast.error("Please select at least 3 sections");
      return;
    }
    onSave(Array.from(selected));
    toast.success(`${selected.size} section(s) selected`);
  }

  return (
    <BaseModal isOpen={true} onClose={onClose} size="md" labelId="sections-modal-title">
        <div className={styles.modalHeader}>
          <div>
            <h2 id="sections-modal-title" className={styles.modalTitle}>Select Proposal Sections</h2>
            <p className={styles.modalSubtitle}>
              {selected.size} of {totalSections} sections selected
            </p>
          </div>
          <Button
            variant="ghost"
            iconOnly
            onClick={onClose}
            aria-label="Close"
            className={styles.closeButton}
          >
            <X size={20} />
          </Button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.searchBar}>
            <Search size={16} className={styles.searchIcon} />
            <Input
              type="text"
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.actionBar}>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={selectAllCore}
                className={styles.toggleAllButton}
              >
                Select All Core
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={deselectAll}
                className={styles.toggleAllButton}
              >
                Deselect All
              </Button>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddCustom(!showAddCustom)}
              className={styles.toggleAllButton}
            >
              <Plus size={14} />
              Add Custom Section
            </Button>
          </div>

          {selected.size < 3 && (
            <div className={styles.warningBox}>
              <AlertCircle size={16} />
              <span>Please select at least 3 sections for your proposal</span>
            </div>
          )}

          {showAddCustom && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Custom Section Name</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <Input
                  type="text"
                  placeholder="e.g., Budget Breakdown"
                  value={customSectionName}
                  onChange={(e) => setCustomSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomSection();
                    }
                  }}
                  autoFocus
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddCustomSection}
                >
                  Add
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowAddCustom(false);
                    setCustomSectionName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className={styles.categoriesList}>
            {Object.entries(categoriesToRender).map(([categoryKey, category]) => {
              const isExpanded = expandedCategories.has(categoryKey);
              const filteredSections = category.sections.filter((sectionKey) =>
                getDisplayName(sectionKey).toLowerCase().includes(searchQuery.toLowerCase())
              );

              if (searchQuery && filteredSections.length === 0) return null;

              return (
                <div key={categoryKey} className={styles.category}>
                  <button
                    className={styles.categoryHeader}
                    onClick={() => toggleCategory(categoryKey)}
                  >
                    <span className={styles.categoryLabel}>{category.label}</span>
                    <span className={styles.categoryCount}>
                      {category.sections.filter((s) => selected.has(s)).length}/{category.sections.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.sectionsList}>
                      {filteredSections.map((sectionKey) => {
                        const isSelected = selected.has(sectionKey);
                        return (
                          <div
                            key={sectionKey}
                            className={`${styles.sectionItem} ${isSelected ? styles.selected : ""}`}
                            onClick={() => toggleSection(sectionKey)}
                            role="button"
                            tabIndex={0}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSection(sectionKey)}
                              className={styles.checkbox}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className={styles.sectionName}>{getDisplayName(sectionKey)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose} className={styles.cancelButton}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} className={styles.saveButton}>
            Save Changes
          </Button>
        </div>
    </BaseModal>
  );
}
