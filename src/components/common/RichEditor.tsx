"use client";

import { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Highlight } from "@tiptap/extension-highlight";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

import { EDITOR_HIGHLIGHT_COLORS, EDITOR_TEXT_COLORS } from "@/constants";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Called when user clicks "Regenerate" in the bubble menu with the selected text. */
  onRegenerateSelection?: (selectedText: string) => void;
}

export default function RichEditor({
  content,
  onChange,
  placeholder = "Start writing…",
  onRegenerateSelection,
}: RichEditorProps): JSX.Element {
  const [regenLoading, setRegenLoading] = useState<boolean>(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "ProseMirror",
        "data-placeholder": placeholder,
      },
    },
  });

  const setColor = useCallback(
    (color: string): void => {
      if (!editor) return;
      if (!color) {
        editor.chain().focus().unsetColor().run();
      } else {
        editor.chain().focus().setColor(color).run();
      }
    },
    [editor]
  );

  const setHighlight = useCallback(
    (color: string): void => {
      if (!editor) return;
      if (!color) {
        editor.chain().focus().unsetHighlight().run();
      } else {
        editor.chain().focus().toggleHighlight({ color }).run();
      }
    },
    [editor]
  );

  const insertTable = useCallback((): void => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  const handleRegenerateSelection = useCallback(async (): Promise<void> => {
    if (!editor || !onRegenerateSelection) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;
    setRegenLoading(true);
    onRegenerateSelection(selectedText);
    setRegenLoading(false);
  }, [editor, onRegenerateSelection]);

  if (!editor) return <div className="rte-content" />;

  return (
    <div>
      {/* ── Fixed toolbar ───────────────────────────────────────────────── */}
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting toolbar">
        {/* Text style */}
        <button
          type="button"
          className={`rte-btn${editor.isActive("bold") ? " active" : ""}`}
          title="Bold (Ctrl+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`rte-btn${editor.isActive("italic") ? " active" : ""}`}
          title="Italic (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`rte-btn rte-strike-btn${editor.isActive("strike") ? " active" : ""}`}
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>S</s>
        </button>

        <div className="rte-toolbar-separator" />

        {/* Headings — H3 for section heading, H4 for sub-heading */}
        <button
          type="button"
          className={`rte-btn rte-btn-wide${editor.isActive("heading", { level: 3 }) ? " active" : ""}`}
          title="Heading (H3)"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          H3
        </button>
        <button
          type="button"
          className={`rte-btn rte-btn-wide${editor.isActive("heading", { level: 4 }) ? " active" : ""}`}
          title="Sub-heading (H4)"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 4 }).run()
          }
        >
          H4
        </button>

        <div className="rte-toolbar-separator" />

        {/* Lists */}
        <button
          type="button"
          className={`rte-btn rte-btn-wide${editor.isActive("bulletList") ? " active" : ""}`}
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </button>
        <button
          type="button"
          className={`rte-btn rte-btn-wide${editor.isActive("orderedList") ? " active" : ""}`}
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>

        <div className="rte-toolbar-separator" />

        {/* Highlight swatches */}
        <span className="rte-toolbar-label">HL</span>
        {EDITOR_HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color || "none"}
            type="button"
            className="rte-color-btn"
            title={color ? `Highlight: ${color}` : "Remove highlight"}
            onClick={() => setHighlight(color)}
          >
            <div
              className={`rte-color-swatch${color ? "" : " rte-color-swatch-empty"}`}
              style={color ? { background: color } : undefined}
            />
          </button>
        ))}

        <div className="rte-toolbar-separator" />

        {/* Text color swatches */}
        <span className="rte-toolbar-label">A</span>
        {EDITOR_TEXT_COLORS.map((color) => (
          <button
            key={color || "none"}
            type="button"
            className="rte-color-btn"
            title={color ? `Color: ${color}` : "Default color"}
            onClick={() => setColor(color)}
          >
            <div
              className={`rte-color-swatch${color ? "" : " rte-color-swatch-empty"}`}
              style={color ? { background: color } : undefined}
            />
          </button>
        ))}

        <div className="rte-toolbar-separator" />

        {/* Table */}
        <button
          type="button"
          className="rte-btn rte-btn-wide"
          title="Insert table"
          onClick={insertTable}
        >
          ⊞ Table
        </button>
        {editor.isActive("table") && (
          <>
            <button
              type="button"
              className="rte-btn rte-btn-wide"
              title="Add column"
              onClick={() =>
                editor.chain().focus().addColumnAfter().run()
              }
            >
              +Col
            </button>
            <button
              type="button"
              className="rte-btn rte-btn-wide"
              title="Add row"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              +Row
            </button>
            <button
              type="button"
              className="rte-btn rte-btn-wide"
              title="Delete table"
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              Del
            </button>
          </>
        )}
      </div>

      {/* Editor content */}
      <div className="rte-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
