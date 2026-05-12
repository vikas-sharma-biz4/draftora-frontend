"use client";

import React, { useState } from "react";
import { X, Search, AlertCircle } from "lucide-react";
import { toast } from "@/utils/toast";

import styles from "../EditModal.module.scss";
import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import { Input } from "@/components/common/Input";
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
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedSections));
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(SECTION_CATEGORIES))
  );

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
