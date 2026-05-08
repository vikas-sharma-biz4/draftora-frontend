"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import styles from "./EditModal.module.scss";
import { SECTION_DISPLAY_NAMES } from "@/constants";

interface SectionsSelectorModalProps {
  selectedSections: string[];
  sectionDisplayNames: Record<string, string>;
  onClose: () => void;
  onSave: (sections: string[]) => void;
}

const SECTION_CATEGORIES = {
  core: {
    label: "Core Sections",
    sections: ["introduction", "purpose", "executive_summary"],
  },
  technical: {
    label: "Technical",
    sections: [
      "high_level_scope",
      "high_level_feature_list",
      "nfrs",
      "technology_stack",
      "system_architecture",
    ],
  },
  planning: {
    label: "Planning",
    sections: ["timeline", "milestones", "dependencies", "user_flow_diagram"],
  },
  risk: {
    label: "Risk & Compliance",
    sections: ["risks_assumptions", "mitigations"],
  },
  company: {
    label: "Company Info",
    sections: ["similar_projects", "approach_methodology", "client_dependencies", "communication"],
  },
};

export default function SectionsSelectorModal({
  selectedSections,
  sectionDisplayNames,
  onClose,
  onSave,
}: SectionsSelectorModalProps): JSX.Element | null {
  const [mounted, setMounted] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedSections));
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(SECTION_CATEGORIES))
  );

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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
    const coreSections = SECTION_CATEGORIES.core.sections;
    setSelected((prev) => {
      const newSet = new Set(prev);
      coreSections.forEach((s) => newSet.add(s));
      return newSet;
    });
  }

  function deselectAll(): void {
    setSelected(new Set());
  }

  function handleSave(): void {
    if (selected.size < 3) {
      toast.error("Please select at least 3 sections");
      return;
    }
    onSave(Array.from(selected));
    toast.success(`${selected.size} section(s) selected`);
  }

  const totalSections = Object.values(SECTION_CATEGORIES).reduce(
    (acc, cat) => acc + cat.sections.length,
    0
  );

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Select Proposal Sections</h2>
            <p className={styles.modalSubtitle}>
              {selected.size} of {totalSections} sections selected
            </p>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.searchBar}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.actionBar}>
            <button className={styles.toggleAllButton} onClick={selectAllCore}>
              Select All Core
            </button>
            <button className={styles.toggleAllButton} onClick={deselectAll}>
              Deselect All
            </button>
          </div>

          {selected.size < 3 && (
            <div className={styles.warningBox}>
              <AlertCircle size={16} />
              <span>Please select at least 3 sections for your proposal</span>
            </div>
          )}

          <div className={styles.categoriesList}>
            {Object.entries(SECTION_CATEGORIES).map(([categoryKey, category]) => {
              const isExpanded = expandedCategories.has(categoryKey);
              const filteredSections = category.sections.filter((sectionKey) => {
                const displayName =
                  sectionDisplayNames[sectionKey] ||
                  SECTION_DISPLAY_NAMES[sectionKey] ||
                  sectionKey;
                return displayName.toLowerCase().includes(searchQuery.toLowerCase());
              });

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
                        const displayName =
                          sectionDisplayNames[sectionKey] ||
                          SECTION_DISPLAY_NAMES[sectionKey] ||
                          sectionKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
                            <span className={styles.sectionName}>{displayName}</span>
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
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
