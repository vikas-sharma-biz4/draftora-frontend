"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Check, X } from "lucide-react";

export interface SectionItem {
  key: string;
  label: string;
}

interface SortableSectionListProps {
  sections: SectionItem[];
  editingKey: string | null;
  editLabel: string;
  onSectionsChange: (sections: SectionItem[]) => void;
  onStartEdit: (item: SectionItem) => void;
  onSaveEdit: (key: string) => void;
  onCancelEdit: () => void;
  onRemove: (key: string) => void;
  onEditLabelChange: (val: string) => void;
}

interface SortableSectionProps {
  item: SectionItem;
  index: number;
  editingKey: string | null;
  editLabel: string;
  onStartEdit: (item: SectionItem) => void;
  onSaveEdit: (key: string) => void;
  onCancelEdit: () => void;
  onRemove: (key: string) => void;
  onEditLabelChange: (val: string) => void;
}

function SortableSection({
  item,
  index,
  editingKey,
  editLabel,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  onEditLabelChange,
}: SortableSectionProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isEditing = editingKey === item.key;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`section-structure-item${isDragging ? " dragging" : ""}`}
    >
      <span
        className="section-drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </span>

      <span className="section-structure-num" aria-hidden="true">
        {index + 1}
      </span>

      {isEditing ? (
        <input
          className="section-name-input"
          value={editLabel}
          onChange={(e) => onEditLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit(item.key);
            if (e.key === "Escape") onCancelEdit();
          }}
          autoFocus
          aria-label="Section name"
        />
      ) : (
        <span className="section-structure-name">{item.label}</span>
      )}

      <div className="section-structure-actions">
        {isEditing ? (
          <>
            <button
              className="icon-btn-plain"
              title="Save"
              onClick={() => onSaveEdit(item.key)}
            >
              <Check size={13} />
            </button>
            <button
              className="icon-btn-plain"
              title="Cancel"
              onClick={onCancelEdit}
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <button
              className="icon-btn-plain"
              title="Rename section"
              onClick={() => onStartEdit(item)}
            >
              <Pencil size={13} />
            </button>
            <button
              className="icon-btn-plain danger"
              title="Remove section"
              onClick={() => onRemove(item.key)}
            >
              <X size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Drag-and-drop sortable section list using @dnd-kit.
 * Intended to be dynamically imported to avoid loading the heavy
 * DnD libraries in the initial bundle.
 */
export default function SortableSectionList({
  sections,
  editingKey,
  editLabel,
  onSectionsChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  onEditLabelChange,
}: SortableSectionListProps): JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = sections.findIndex((s) => s.key === active.id);
      const newIdx = sections.findIndex((s) => s.key === over.id);
      onSectionsChange(arrayMove(sections, oldIdx, newIdx));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sections.map((s) => s.key)}
        strategy={verticalListSortingStrategy}
      >
        <div className="section-structure-list">
          {sections.map((item, index) => (
            <SortableSection
              key={item.key}
              item={item}
              index={index}
              editingKey={editingKey}
              editLabel={editLabel}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onRemove={onRemove}
              onEditLabelChange={onEditLabelChange}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
