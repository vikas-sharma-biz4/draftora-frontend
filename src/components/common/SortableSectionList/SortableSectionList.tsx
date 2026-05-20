"use client";

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
import { GripVertical, Pencil, Check, X, Plus } from "lucide-react";

export interface SectionItem {
  key: string;
  label: string;
  level?: number;
  parentId?: string;
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
  onAddAfter: (key: string) => void;
}

interface SortableSectionProps {
  item: SectionItem;
  index: number;
  sectionNumber: string;
  editingKey: string | null;
  editLabel: string;
  onStartEdit: (item: SectionItem) => void;
  onSaveEdit: (key: string) => void;
  onCancelEdit: () => void;
  onRemove: (key: string) => void;
  onEditLabelChange: (val: string) => void;
  onAddAfter: (key: string) => void;
}

function SortableSection({
  item,
  index,
  sectionNumber,
  editingKey,
  editLabel,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  onEditLabelChange,
  onAddAfter,
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
  const level = item.level || 1;
  const isChild = level > 1 || Boolean(item.parentId);
  const indentPx = (level - 1) * 24;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`section-structure-item${isDragging ? " dragging" : ""}${isChild ? " section-child" : ""}`}
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
        {sectionNumber}
      </span>

      <div className="section-content-wrapper" style={{ marginLeft: `${indentPx}px` }}>
        {isChild && (
          <span className="section-child-indicator" aria-hidden="true" title="Subsection">
            ↳
          </span>
        )}
        
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
          <span 
            className="section-structure-name" 
            style={{ fontWeight: level === 1 ? 600 : 400 }}
          >
            {item.label}
          </span>
        )}
      </div>

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
              className="icon-btn-plain"
              title="Add section after this"
              onClick={() => onAddAfter(item.key)}
            >
              <Plus size={13} />
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
// Custom modifier to restrict dragging within window bounds
const restrictToWindowBounds: Modifier = ({ transform, active }) => {
  const { x, y } = transform;
  
  if (!active || !active.rect.current) {
    return transform;
  }

  const rect = active.rect.current.translated || active.rect.current.initial;
  if (!rect) {
    return transform;
  }

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  const elementWidth = rect.width;
  const elementHeight = rect.height;
  
  // Calculate boundaries
  const minX = 0;
  const maxX = windowWidth - elementWidth;
  const minY = 0;
  const maxY = windowHeight - elementHeight;
  
  // Constrain x and y within bounds
  const constrainedX = Math.max(minX, Math.min(maxX, x));
  const constrainedY = Math.max(minY, Math.min(maxY, y));
  
  return {
    ...transform,
    x: constrainedX,
    y: constrainedY,
  };
};

// Custom modifier to restrict dragging to vertical axis only
const restrictToVerticalAxis: Modifier = ({ transform }) => {
  return {
    ...transform,
    x: 0,
  };
};

// Custom modifier to restrict dragging within parent element bounds
const restrictToParentElement: Modifier = ({ transform, active, containerNodeRect }) => {
  const { x, y } = transform;
  
  if (!active || !active.rect.current || !containerNodeRect) {
    return transform;
  }

  const initialRect = active.rect.current.initial;
  const translatedRect = active.rect.current.translated;
  
  if (!initialRect) {
    return transform;
  }

  // Calculate how far the element can move in each direction
  // The transform is relative to the initial position
  const initialTop = initialRect.top;
  const initialBottom = initialRect.bottom;
  const initialLeft = initialRect.left;
  const initialRight = initialRect.right;
  
  const containerTop = containerNodeRect.top;
  const containerBottom = containerNodeRect.bottom;
  const containerLeft = containerNodeRect.left;
  const containerRight = containerNodeRect.right;
  
  // Calculate maximum allowed offsets
  const maxUpwardMove = initialTop - containerTop;
  const maxDownwardMove = containerBottom - initialBottom;
  const maxLeftMove = initialLeft - containerLeft;
  const maxRightMove = containerRight - initialRight;
  
  // Constrain the transform values
  const constrainedX = Math.max(-maxLeftMove, Math.min(maxRightMove, x));
  const constrainedY = Math.max(-maxUpwardMove, Math.min(maxDownwardMove, y));
  
  return {
    ...transform,
    x: constrainedX,
    y: constrainedY,
  };
};

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
  onAddAfter,
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

  // Calculate hierarchical section numbers
  function calculateSectionNumber(index: number): string {
    const item = sections[index];
    const level = item.level || 1;
    
    if (level === 1 || !item.parentId) {
      // Main section: count previous main sections
      let mainSectionCount = 1;
      for (let i = 0; i < index; i++) {
        const prevLevel = sections[i].level || 1;
        if (prevLevel === 1 || !sections[i].parentId) {
          mainSectionCount++;
        }
      }
      return String(mainSectionCount);
    } else {
      // Subsection: find parent number and count siblings
      let parentNumber = "";
      let childIndex = 1;
      
      // Find parent section number
      for (let i = index - 1; i >= 0; i--) {
        const prevLevel = sections[i].level || 1;
        if (prevLevel === 1 || !sections[i].parentId) {
          // Found parent - calculate its number
          let mainCount = 1;
          for (let j = 0; j < i; j++) {
            const pLevel = sections[j].level || 1;
            if (pLevel === 1 || !sections[j].parentId) {
              mainCount++;
            }
          }
          parentNumber = String(mainCount);
          break;
        }
      }
      
      // Count previous siblings under same parent
      for (let i = 0; i < index; i++) {
        if (sections[i].parentId === item.parentId && (sections[i].level || 1) > 1) {
          childIndex++;
        }
      }
      
      return `${parentNumber}.${childIndex}`;
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
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
              sectionNumber={calculateSectionNumber(index)}
              editingKey={editingKey}
              editLabel={editLabel}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onRemove={onRemove}
              onEditLabelChange={onEditLabelChange}
              onAddAfter={onAddAfter}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
