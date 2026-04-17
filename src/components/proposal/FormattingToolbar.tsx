"use client";

import { Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered, Sparkles } from "lucide-react";

interface FormattingToolbarProps {
  position: { top: number; left: number };
  onFormat: (formatType: string) => void;
  onRegenerate?: () => void;
}

export default function FormattingToolbar({
  position,
  onFormat,
  onRegenerate,
}: FormattingToolbarProps): JSX.Element {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="formatting-toolbar"
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
        zIndex: 1000,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="formatting-toolbar-content">
        <button
          type="button"
          className="toolbar-btn"
          title="Bold (Ctrl+B)"
          onClick={() => onFormat("bold")}
        >
          <Bold size={16} />
        </button>

        <button
          type="button"
          className="toolbar-btn"
          title="Italic (Ctrl+I)"
          onClick={() => onFormat("italic")}
        >
          <Italic size={16} />
        </button>

        <button
          type="button"
          className="toolbar-btn"
          title="Strikethrough"
          onClick={() => onFormat("strikeThrough")}
        >
          <Strikethrough size={16} />
        </button>

        <div className="toolbar-separator" />

        <button
          type="button"
          className="toolbar-btn"
          title="Heading 2"
          onClick={() => onFormat("formatBlock")}
        >
          <Heading2 size={16} />
        </button>

        <button
          type="button"
          className="toolbar-btn"
          title="Heading 3"
          onClick={() => onFormat("formatBlock")}
        >
          <Heading3 size={16} />
        </button>

        <div className="toolbar-separator" />

        <button
          type="button"
          className="toolbar-btn"
          title="Bullet List"
          onClick={() => onFormat("insertUnorderedList")}
        >
          <List size={16} />
        </button>

        <button
          type="button"
          className="toolbar-btn"
          title="Numbered List"
          onClick={() => onFormat("insertOrderedList")}
        >
          <ListOrdered size={16} />
        </button>

        {onRegenerate && (
          <>
            <div className="toolbar-separator" />
            <button
              type="button"
              className="toolbar-btn toolbar-btn-regenerate"
              title="Regenerate with AI"
              onClick={onRegenerate}
            >
              <Sparkles size={16} />
              <span>Regen</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
