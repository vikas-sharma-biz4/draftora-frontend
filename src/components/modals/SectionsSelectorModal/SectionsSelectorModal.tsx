"use client";

import React, { useState, useMemo } from "react";
import { X, Search, Plus } from "lucide-react";
import { toast } from "@/utils/toast";

import styles from "../EditModal.module.scss";
import BaseModal from "@/components/common/BaseModal";
import Button from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import AddSectionModal from "@/components/modals/AddSectionModal/AddSectionModal";
import { SECTION_DISPLAY_NAMES, STATIC_SECTION_DISPLAY_NAMES } from "@/constants";
import type { CustomSection } from "@/interfaces/proposalInterfaces";

interface SectionsSelectorModalProps {
  selectedSections: string[];
  sectionDisplayNames: Record<string, string>;
  customSections?: CustomSection[];
  onClose: () => void;
  onSave: (sections: string[], newCustomSections?: CustomSection[]) => void;
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
      "scope_of_work",
      "poc_features_list",
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
      "estimated_timeline",
      "deliverables",
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
    sections: ["similar_projects", "our_approach_methodology", "our_proven_approach"],
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

const SECTIONS_GROUP: string[] = [
  ...SECTION_CATEGORIES.core.sections,
  ...SECTION_CATEGORIES.technical.sections,
  ...SECTION_CATEGORIES.planning.sections,
  ...SECTION_CATEGORIES.risk.sections,
  ...SECTION_CATEGORIES.company.sections,
];

const STATIC_SECTIONS_GROUP: string[] = SECTION_CATEGORIES.static.sections;

const ALL_CATEGORIZED_SECTIONS = new Set(
  Object.values(SECTION_CATEGORIES).flatMap((c) => c.sections)
);

function buildSectionKey(name: string): string {
  return (
    "custom_" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40)
  );
}

export default function SectionsSelectorModal({
  selectedSections,
  sectionDisplayNames,
  customSections,
  onClose,
  onSave,
}: SectionsSelectorModalProps): JSX.Element | null {
  // Static sections are always included — initialize with them pre-selected
  const [selected, setSelected] = useState<Set<string>>(
    new Set([...selectedSections, ...STATIC_SECTIONS_GROUP])
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  // key → displayName; initialized from existing custom sections so they survive re-opens
  const [customSectionNames, setCustomSectionNames] = useState<Record<string, string>>(() =>
    Object.fromEntries((customSections ?? []).map((cs) => [cs.key, cs.label]))
  );
  // key → AI instructions; initialized from existing custom sections
  const [customSectionInstructions, setCustomSectionInstructions] = useState<
    Record<string, string>
  >(() => Object.fromEntries((customSections ?? []).map((cs) => [cs.key, cs.description])));
  const [showAddSectionModal, setShowAddSectionModal] = useState<boolean>(false);
  const [isAddingSection, setIsAddingSection] = useState<boolean>(false);

  const allDisplayNames = useMemo(
    () => ({
      ...SECTION_DISPLAY_NAMES,
      ...STATIC_SECTION_DISPLAY_NAMES,
      ...sectionDisplayNames,
      ...customSectionNames,
    }),
    [sectionDisplayNames, customSectionNames]
  );

  const uncategorizedSections = useMemo(() => {
    const allCustomKeys = Object.keys(customSectionNames);
    const allUncategorized = [
      ...selectedSections.filter((s) => !ALL_CATEGORIZED_SECTIONS.has(s)),
      ...allCustomKeys,
    ];
    return Array.from(new Set(allUncategorized));
  }, [selectedSections, customSectionNames]);

  const allSectionsGroup = useMemo(
    () => [...SECTIONS_GROUP, ...uncategorizedSections],
    [uncategorizedSections]
  );

  const totalSections = useMemo(() => {
    return new Set([...SECTIONS_GROUP, ...STATIC_SECTIONS_GROUP, ...uncategorizedSections]).size;
  }, [uncategorizedSections]);

  function getDisplayName(sectionKey: string): string {
    return (
      allDisplayNames[sectionKey] ||
      sectionKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  function toggleSection(sectionKey: string): void {
    if (STATIC_SECTIONS_GROUP.includes(sectionKey)) return;
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

  function selectAllSections(): void {
    setSelected((prev) => {
      const newSet = new Set(prev);
      allSectionsGroup.forEach((s) => newSet.add(s));
      return newSet;
    });
  }

  function deselectAllSections(): void {
    setSelected((prev) => {
      const newSet = new Set(prev);
      allSectionsGroup.forEach((s) => newSet.delete(s));
      return newSet;
    });
  }

  async function handleAddSectionSubmit(name: string, instructions: string): Promise<void> {
    setIsAddingSection(true);
    try {
      const sectionKey = buildSectionKey(name);
      setCustomSectionNames((prev) => ({ ...prev, [sectionKey]: name }));
      setCustomSectionInstructions((prev) => ({ ...prev, [sectionKey]: instructions }));
      setSelected((prev) => new Set([...Array.from(prev), sectionKey]));
      setShowAddSectionModal(false);
      toast.success(`Section "${name}" added`);
    } finally {
      setIsAddingSection(false);
    }
  }

  function handleSave(): void {
    // Always include static sections in the final selection
    const finalSelected = new Set([...selected, ...STATIC_SECTIONS_GROUP]);

    if (finalSelected.size < 3) {
      toast.error("Please select at least 3 sections");
      return;
    }

    const newCustomSections: CustomSection[] = Object.entries(customSectionNames).map(
      ([key, label]) => ({
        key,
        label,
        description: customSectionInstructions[key] ?? "",
      })
    );

    const allSelected = Array.from(finalSelected);
    const nonStaticSelected = allSelected.filter((s) => !STATIC_SECTIONS_GROUP.includes(s));
    const staticSelected = allSelected.filter((s) => STATIC_SECTIONS_GROUP.includes(s));
    onSave(
      [...nonStaticSelected, ...staticSelected],
      newCustomSections.length > 0 ? newCustomSections : undefined
    );
  }

  const filteredSectionsGroup = allSectionsGroup.filter((s) =>
    getDisplayName(s).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStaticGroup = STATIC_SECTIONS_GROUP.filter((s) =>
    getDisplayName(s).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sectionsSelectedCount = allSectionsGroup.filter((s) => selected.has(s)).length;

  const allExistingKeys = [...allSectionsGroup, ...STATIC_SECTIONS_GROUP];

  return (
    <>
      <BaseModal isOpen={true} onClose={onClose} size="md" labelId="sections-modal-title">
        <div className={styles.modalHeader}>
          <div>
            <h2 id="sections-modal-title" className={styles.modalTitle}>
              Select Proposal Sections
            </h2>
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
            <div />
            <Button variant="primary" size="sm" onClick={() => setShowAddSectionModal(true)}>
              <Plus size={14} />
              Add Custom Section
            </Button>
          </div>

          <div className={styles.categoriesList}>
            {/* Sections group */}
            {(!searchQuery || filteredSectionsGroup.length > 0) && (
              <div className={styles.category}>
                <div className={styles.categoryHeader} style={{ cursor: "default" }}>
                  <span className={styles.categoryLabel}>Sections</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={styles.categoryCount}>
                      {sectionsSelectedCount}/{allSectionsGroup.length}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={selectAllSections}
                      className={styles.toggleAllButton}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={deselectAllSections}
                      className={styles.toggleAllButton}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className={styles.sectionsList}>
                  {filteredSectionsGroup.map((sectionKey) => {
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
              </div>
            )}

            {/* Static Sections group — always included, not selectable */}
            {(!searchQuery || filteredStaticGroup.length > 0) && (
              <div className={styles.category}>
                <div className={styles.categoryHeader} style={{ cursor: "default" }}>
                  <span className={styles.categoryLabel}>Static Sections</span>
                  <span className={styles.alwaysIncludedBadge}>Always Included</span>
                </div>
                <div className={styles.sectionsList}>
                  {filteredStaticGroup.map((sectionKey) => (
                    <div
                      key={sectionKey}
                      className={`${styles.sectionItem} ${styles.sectionItemStatic}`}
                    >
                      <span className={styles.staticCheckmark}>✓</span>
                      <span className={styles.sectionName}>{getDisplayName(sectionKey)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <Button variant="primary" onClick={handleSave} className={styles.saveButton}>
            Save Changes
          </Button>
        </div>
      </BaseModal>

      <AddSectionModal
        isOpen={showAddSectionModal}
        isGenerating={isAddingSection}
        existingKeys={allExistingKeys}
        onClose={() => setShowAddSectionModal(false)}
        onSubmit={handleAddSectionSubmit}
      />
    </>
  );
}
