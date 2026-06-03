/**
 * ProposalSidebar component
 *
 * Handles sidebar section management including:
 * - Drag-and-drop section reordering via @dnd-kit
 * - Section renaming (inline)
 * - Section removal
 * - Adding new sections (via AddSectionModal) at any position
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Pencil, Plus, X, Lock } from "lucide-react";

import { toast } from "@/utils/toast";
import { MESSAGES } from "@/constants/messages";
import { STATIC_SECTION_KEYS } from "@/constants";
import {
  addProposalSection,
  removeProposalSection,
  reorderProposalSections,
} from "@/services/proposal.service";
import AddSectionModal from "@/components/modals/AddSectionModal";
import { generateFormatRules } from "@/utils/formatRules";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SectionMeta {
  key: string;
  label: string;
  hasContent: boolean;
  isStatic?: boolean;
}

export interface ProposalSidebarProps {
  proposalId: number;
  sections: SectionMeta[];
  activeSection: string;
  onSectionClick: (key: string) => void;
  onSectionRenamed: (key: string, newLabel: string) => void;
  onSectionRemoved: (key: string) => void;
  /** afterKey is the key of the section after which the new one is inserted */
  onSectionAdded: (
    key: string,
    label: string,
    content: string,
    afterKey?: string,
    formatType?: string
  ) => void;
  /** Called after drag-end with the new ordered list of section keys */
  onSectionsReordered: (newOrder: string[]) => void;
  /** Template type for format rules */
  templateType?: string;
}

// ─── DnD modifier — restrict to vertical axis ─────────────────────────────────

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

// ─── Key builder (shared with AddSectionModal validation) ─────────────────────

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

// ─── SortableProposalSection ───────────────────────────────────────────────────

interface SortableSectionProps {
  section: SectionMeta;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  isPending: boolean;
  onSectionClick: () => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onRenameValueChange: (val: string) => void;
  onRemove: () => void;
  onAddAfter: () => void;
}

function SortableProposalSection({
  section,
  isActive,
  isRenaming,
  renameValue,
  isPending,
  onSectionClick,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onRenameValueChange,
  onRemove,
  onAddAfter,
}: SortableSectionProps): JSX.Element {
  const isStatic = section.isStatic || false;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`proposal-sidebar-sortable-item${isDragging ? " dragging" : ""}`}
    >
      <div
        className={`proposal-sidebar-section-row${isActive ? " active" : ""}${isPending ? " pending" : ""}${isStatic ? " is-static" : ""}`}
        onClick={() => !isRenaming && !isPending && onSectionClick()}
      >
        {/* Drag handle — visible on row hover */}
        {!isStatic && (
          <span
            className="proposal-sidebar-drag-handle"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder section"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={11} />
          </span>
        )}

        <span className={`proposal-sidebar-dot ${section.hasContent ? "has-content" : "empty"}`} />

        {isRenaming ? (
          <input
            className="proposal-sidebar-section-edit-input"
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveRename();
              if (e.key === "Escape") onCancelRename();
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="proposal-sidebar-section-name">
            {isPending && <span className="proposal-sidebar-pending-spinner" aria-hidden="true" />}
            {section.label}
          </span>
        )}

        {isRenaming ? (
          <div className="proposal-sidebar-section-actions flex-center">
            <button
              className="proposal-sidebar-icon-btn"
              title="Save rename"
              onClick={(e) => {
                e.stopPropagation();
                onSaveRename();
              }}
            >
              <Check size={11} />
            </button>
            <button
              className="proposal-sidebar-icon-btn"
              title="Cancel rename"
              onClick={(e) => {
                e.stopPropagation();
                onCancelRename();
              }}
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          !isStatic && (
            <div className="proposal-sidebar-section-actions">
              <button
                className="proposal-sidebar-icon-btn"
                title="Rename section"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRename();
                }}
                disabled={isPending}
              >
                <Pencil size={11} />
              </button>
              <button
                className="proposal-sidebar-icon-btn"
                title="Add section after this"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAfter();
                }}
                disabled={isPending}
              >
                <Plus size={11} />
              </button>
              <button
                className="proposal-sidebar-icon-btn danger"
                title="Remove section"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                disabled={isPending}
              >
                <X size={11} />
              </button>
            </div>
          )
        )}
      </div>
    </li>
  );
}

// ─── ProposalSidebar ───────────────────────────────────────────────────────────

export default function ProposalSidebar({
  proposalId,
  sections,
  activeSection,
  onSectionClick,
  onSectionRenamed,
  onSectionRemoved,
  onSectionAdded,
  onSectionsReordered,
  templateType,
}: ProposalSidebarProps): JSX.Element {
  // ── Sidebar list ref for active-section scroll sync ──────────────────────
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const activeItem = listRef.current.querySelector<HTMLElement>(
      ".proposal-sidebar-section-row.active"
    );
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSection]);

  // ── Local ordered state — reconciled with props ───────────────────────────
  const [orderedSections, setOrderedSections] = useState<SectionMeta[]>(sections);

  useEffect(() => {
    setOrderedSections((prev) => {
      const sectionMap = new Map(sections.map((s) => [s.key, s]));
      const prevKeySet = new Set(prev.map((s) => s.key));

      const hasNewKeys = sections.some((s) => !prevKeySet.has(s.key));

      if (hasNewKeys) {
        // A section was added by the parent — adopt parent ordering in full
        return sections.map((s) => sectionMap.get(s.key)!).filter(Boolean);
      }

      // No new sections — preserve drag order; update metadata & drop removals
      const currentKeySet = new Set(sections.map((s) => s.key));
      return prev.filter((s) => currentKeySet.has(s.key)).map((s) => sectionMap.get(s.key) ?? s);
    });
  }, [sections]);

  // ── Rename state ─────────────────────────────────────────────────────────
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

  // ── Add-section modal state ──────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [insertAfterKey, setInsertAfterKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // ── DnD sensors ──────────────────────────────────────────────────────────
  // activationConstraint prevents the PointerSensor from intercepting normal clicks.
  // Without it, any pointerdown inside DndContext enters drag-tracking mode which
  // can suppress subsequent click events on section rows.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Rename handlers ───────────────────────────────────────────────────────

  function startRename(key: string, currentLabel: string): void {
    setRenamingKey(key);
    setRenameValue(currentLabel);
  }

  function saveRename(key: string): void {
    const label = renameValue.trim();
    if (!label) return;
    onSectionRenamed(key, label);
    setRenamingKey(null);
  }

  // ── Remove handler ────────────────────────────────────────────────────────

  async function handleRemoveSection(key: string): Promise<void> {
    // Prevent removal of static sections
    if ((STATIC_SECTION_KEYS as readonly string[]).includes(key)) {
      toast.error("Not allowed on static sections");
      return;
    }

    if (sections.length <= 1) {
      toast.error(MESSAGES.PROPOSAL_MIN_SECTIONS);
      return;
    }
    try {
      await removeProposalSection(proposalId, key);
      onSectionRemoved(key);
      toast.success(MESSAGES.PROPOSAL_SECTION_REMOVED);
    } catch {
      toast.error(MESSAGES.PROPOSAL_SECTION_REMOVE_FAILED);
    }
  }

  // ── Add-section handlers ──────────────────────────────────────────────────

  function openAddModal(afterKey?: string): void {
    setInsertAfterKey(afterKey ?? null);
    setIsAddModalOpen(true);
  }

  function closeAddModal(): void {
    setIsAddModalOpen(false);
    setInsertAfterKey(null);
  }

  const handleAddSection = useCallback(
    async (name: string, instructions: string): Promise<void> => {
      const key = buildSectionKey(name);

      if (orderedSections.some((s) => s.key === key)) {
        toast.error(MESSAGES.PROPOSAL_SECTION_NAME_EXISTS);
        return;
      }

      setIsGenerating(true);
      try {
        toast.info(MESSAGES.PROPOSAL_SECTION_GENERATING);

        // Generate format rules based on template type and section name
        const formatRules = generateFormatRules(templateType, name, instructions);

        const result = await addProposalSection(proposalId, {
          key,
          label: name,
          instructions: instructions || undefined,
          templateType,
          formatRules,
        });
        onSectionAdded(key, name, result.content, insertAfterKey ?? undefined, result.formatType);
        closeAddModal();
        toast.success(MESSAGES.PROPOSAL_SECTION_ADDED(name));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : MESSAGES.PROPOSAL_SECTION_ADD_FAILED;
        toast.error(message);
      } finally {
        setIsGenerating(false);
      }
    },
    [proposalId, orderedSections, insertAfterKey, onSectionAdded, templateType]
  );

  // ── Drag-end handler ──────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = orderedSections.findIndex((s) => s.key === active.id);
    const newIdx = orderedSections.findIndex((s) => s.key === over.id);
    const newOrder = arrayMove(orderedSections, oldIdx, newIdx);

    setOrderedSections(newOrder);

    const newKeys = newOrder.map((s) => s.key);
    onSectionsReordered(newKeys);

    reorderProposalSections(proposalId, { order: newKeys }).catch(() =>
      toast.error(MESSAGES.PROPOSAL_SECTIONS_REORDER_FAILED)
    );
  }

  // ── Derived helpers ───────────────────────────────────────────────────────

  const existingKeys = orderedSections.map((s) => s.key);

  const insertAfterLabel = insertAfterKey
    ? (orderedSections.find((s) => s.key === insertAfterKey)?.label ?? undefined)
    : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <nav className="proposal-sidebar" aria-label="Proposal sections">
        <div className="proposal-sidebar-title">Sections</div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={orderedSections.map((s) => s.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul ref={listRef} className="proposal-sidebar-links">
              {orderedSections.map(({ key, label, hasContent, isStatic }) => (
                <SortableProposalSection
                  key={key}
                  section={{ key, label, hasContent, isStatic }}
                  isActive={activeSection === key}
                  isRenaming={renamingKey === key}
                  renameValue={renameValue}
                  isPending={false}
                  onSectionClick={() => onSectionClick(key)}
                  onStartRename={() => startRename(key, label)}
                  onSaveRename={() => saveRename(key)}
                  onCancelRename={() => setRenamingKey(null)}
                  onRenameValueChange={setRenameValue}
                  onRemove={() => void handleRemoveSection(key)}
                  onAddAfter={() => openAddModal(key)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </nav>

      <AddSectionModal
        isOpen={isAddModalOpen}
        isGenerating={isGenerating}
        existingKeys={existingKeys}
        insertAfterLabel={insertAfterLabel}
        templateType={templateType}
        onClose={closeAddModal}
        onSubmit={handleAddSection}
      />
    </>
  );
}
