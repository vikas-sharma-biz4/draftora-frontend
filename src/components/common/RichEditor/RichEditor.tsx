"use client";

import { useEffect, useState, useCallback, useRef, useId } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { createPortal } from "react-dom";
import { toolbarManager } from "./FloatingToolbarManager";

import { Input } from "@/components/common/Input";
import { type RegenerateSelectionResult } from "@/services/proposal/proposalSections.service";
import { logger } from "@/utils/logger";
import { plainTextToHtml } from "@/utils/contentParser";

const TEXT_COLOR_PRESETS = [
  "#000000",
  "#1d4ed8",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#d97706",
];
const HIGHLIGHT_COLOR_PRESETS = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#ddd6fe", "#fed7aa"];

interface RegenerateSelectionParams {
  selectedText: string;
  selectionRange: { from: number; to: number };
  instructions?: string;
  selectionContext?: string;
}

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Called when user submits regeneration with selection context and instructions. */
  onRegenerateSelection?: (
    params: RegenerateSelectionParams
  ) => Promise<RegenerateSelectionResult | null>;
}

function DropdownPortal({
  triggerRef,
  isOpen,
  children,
  className,
}: {
  triggerRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef.current || !elRef.current) return;
    let rafId: number;
    const update = () => {
      if (!triggerRef.current || !elRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      elRef.current.style.position = "fixed";
      elRef.current.style.top = `${rect.bottom + 6}px`;
      elRef.current.style.left = `${rect.left}px`;
      elRef.current.style.zIndex = "10001";
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  return createPortal(
    <div ref={elRef} className={`rte-portal-content${className ? ` ${className}` : ""}`}>
      {children}
    </div>,
    document.body
  );
}

export default function RichEditor({
  content,
  onChange,
  placeholder = "Start writing…",
  onRegenerateSelection,
}: RichEditorProps): JSX.Element {
  const [regenLoading, setRegenLoading] = useState<boolean>(false);
  const [showRegenPrompt, setShowRegenPrompt] = useState<boolean>(false);
  const [regenPrompt, setRegenPrompt] = useState<string>("");
  const [savedSelection, setSavedSelection] = useState<{ from: number; to: number } | null>(null);
  const [showHeadingMenu, setShowHeadingMenu] = useState<boolean>(false);
  const [showLinkInput, setShowLinkInput] = useState<boolean>(false);
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [showImageInput, setShowImageInput] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [showTextColorPicker, setShowTextColorPicker] = useState<boolean>(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState<boolean>(false);

  // Ref mirrors showRegenPrompt so closures inside useEffect always read fresh value
  const showRegenPromptRef = useRef<boolean>(false);
  useEffect(() => {
    showRegenPromptRef.current = showRegenPrompt;
  }, [showRegenPrompt]);

  const headingBtnRef = useRef<HTMLButtonElement | null>(null);
  const linkBtnRef = useRef<HTMLButtonElement | null>(null);
  const imageBtnRef = useRef<HTMLButtonElement | null>(null);
  const textColorBtnRef = useRef<HTMLButtonElement | null>(null);
  const highlightBtnRef = useRef<HTMLButtonElement | null>(null);

  const editorId = useId();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: "proposal-image" },
      }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "ProseMirror",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (currentHtml === content || editor.isFocused) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

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
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const setLink = useCallback((): void => {
    if (!editor || !linkUrl) return;
    editor.chain().focus().setLink({ href: linkUrl }).run();
    setLinkUrl("");
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback((): void => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  const insertImage = useCallback((): void => {
    if (!editor || !imageUrl) return;
    editor.chain().focus().setImage({ src: imageUrl }).run();
    setImageUrl("");
    setShowImageInput(false);
  }, [editor, imageUrl]);

  const insertHorizontalRule = useCallback((): void => {
    if (!editor) return;
    editor.chain().focus().setHorizontalRule().run();
  }, [editor]);

  const isInList = useCallback(
    (listType: "bulletList" | "orderedList"): boolean => {
      if (!editor) return false;
      const { from } = editor.state.selection;
      const $from = editor.state.doc.resolve(from);
      for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === listType) return true;
      }
      return editor.isActive(listType);
    },
    [editor]
  );

  const handleAiButtonClick = useCallback((): void => {
    if (!editor) return;
    if (showRegenPromptRef.current) {
      setShowRegenPrompt(false);
      setRegenPrompt("");
      setSavedSelection(null);
      return;
    }
    const { from, to } = editor.state.selection;
    if (from === to) return;
    setSavedSelection({ from, to });
    setShowRegenPrompt(true);
    setRegenPrompt("");
  }, [editor]);

  const closeRegenPrompt = useCallback((): void => {
    setShowRegenPrompt(false);
    setRegenPrompt("");
    setSavedSelection(null);
  }, []);

  const handleRegenerateSubmit = useCallback(async (): Promise<void> => {
    if (!editor || !onRegenerateSelection || !savedSelection) return;
    const { from, to } = savedSelection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;

    const contextRadius = 300;
    const doc = editor.state.doc;
    const contextBefore =
      from > 1 ? doc.textBetween(Math.max(0, from - contextRadius), from, " ") : "";
    const contextAfter =
      to < doc.content.size
        ? doc.textBetween(to, Math.min(doc.content.size, to + contextRadius), " ")
        : "";
    const selectionContext = [
      contextBefore && `...${contextBefore}`,
      contextAfter && `${contextAfter}...`,
    ]
      .filter(Boolean)
      .join("\n\n");

    setRegenLoading(true);
    try {
      const result = await onRegenerateSelection({
        selectedText,
        selectionRange: { from, to },
        instructions: regenPrompt.trim() || undefined,
        selectionContext: selectionContext || undefined,
      });

      if (result !== null && editor) {
        const { regeneratedText, format } = result;
        const contentToInsert = plainTextToHtml(regeneratedText);
        editor.chain().focus().setTextSelection({ from, to }).insertContent(contentToInsert).run();
        logger.debug("[RichEditor] Content regenerated with format:", format);
      }
    } catch (error) {
      console.error("[RichEditor] Regeneration failed:", error);
    } finally {
      setRegenLoading(false);
      closeRegenPrompt();
    }
  }, [editor, onRegenerateSelection, savedSelection, regenPrompt, closeRegenPrompt]);

  const handleRegenKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleRegenerateSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeRegenPrompt();
      }
    },
    [handleRegenerateSubmit, closeRegenPrompt]
  );

  const bubbleElRef = useRef<HTMLDivElement | null>(null);
  const [bubbleReady, setBubbleReady] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const keepToolbarVisibleRef = useRef<boolean>(false);
  const toolbarPositionSetRef = useRef<boolean>(false);

  useEffect(() => {
    if (!editor) return;

    const cleanupToolbarState = () => {
      setShowRegenPrompt(false);
      setRegenPrompt("");
      setSavedSelection(null);
      setShowHeadingMenu(false);
      setShowLinkInput(false);
      setShowImageInput(false);
      setHasSelection(false);
      setShowTextColorPicker(false);
      setShowHighlightPicker(false);
    };

    const el = toolbarManager.requestToolbar(editorId, cleanupToolbarState);
    bubbleElRef.current = el;

    const positionToolbar = (from: number, to: number) => {
      if (!el || !toolbarManager.isOwner(editorId)) return;
      const startCoords = editor.view.coordsAtPos(from);
      const endCoords = editor.view.coordsAtPos(to);
      const top = endCoords.bottom + 2;
      let left = (startCoords.left + endCoords.left) / 2;

      el.style.position = "fixed";
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.display = "block";

      const toolbarWidth = el.offsetWidth || 320;
      const viewportWidth = window.innerWidth;
      const padding = 12;
      const toolbarHalfWidth = toolbarWidth / 2;
      const minLeft = padding + toolbarHalfWidth;
      const maxLeft = viewportWidth - padding - toolbarHalfWidth;

      if (left < minLeft) left = minLeft;
      else if (left > maxLeft) left = maxLeft;

      el.style.left = `${left}px`;
      el.style.transform = "translateX(-50%)";
    };

    const handleSelectionUpdate = () => {
      const { from, to, empty } = editor.state.selection;
      const hasTextSelected = !empty && from !== to;

      if (hasTextSelected) {
        if (!toolbarManager.isOwner(editorId)) {
          toolbarManager.requestToolbar(editorId, cleanupToolbarState);
        }

        setHasSelection(true);
        keepToolbarVisibleRef.current = true;

        // Update saved selection if AI panel is open so regen always targets current selection
        if (showRegenPromptRef.current) {
          setSavedSelection({ from, to });
        }

        if (!toolbarPositionSetRef.current) {
          positionToolbar(from, to);
          toolbarPositionSetRef.current = true;
        }
      } else if (!keepToolbarVisibleRef.current) {
        setHasSelection(false);
        setShowRegenPrompt(false);
        setRegenPrompt("");
        setSavedSelection(null);
        setShowHeadingMenu(false);
        setShowLinkInput(false);
        setShowImageInput(false);
        setShowTextColorPicker(false);
        setShowHighlightPicker(false);
        if (el) el.style.display = "none";
      }
    };

    let isMouseDown = false;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't interfere if clicking inside the toolbar bubble or any portal dropdown
      const isInPortal = !!(target as Element).closest?.(".rte-portal-content");
      if ((el && el.contains(target)) || isInPortal) return;

      const editorDom = editor.view.dom;
      if (editorDom.contains(target)) {
        // Starting a new text selection — just track mouse state, don't reset toolbar yet
        isMouseDown = true;
        keepToolbarVisibleRef.current = false;
        toolbarPositionSetRef.current = false;
        setHasSelection(false);
        if (el) el.style.display = "none";
      } else {
        // Clicking completely outside editor and toolbar — reset everything
        keepToolbarVisibleRef.current = false;
        toolbarPositionSetRef.current = false;
        setHasSelection(false);
        setShowRegenPrompt(false);
        setRegenPrompt("");
        setSavedSelection(null);
        setShowHeadingMenu(false);
        setShowLinkInput(false);
        setShowImageInput(false);
        setShowTextColorPicker(false);
        setShowHighlightPicker(false);
        if (el) el.style.display = "none";
      }
    };

    const handleMouseUp = () => {
      if (isMouseDown) {
        isMouseDown = false;
        setTimeout(() => handleSelectionUpdate(), 50);
      }
    };

    const handleScroll = () => {
      requestAnimationFrame(() => {
        if (!el || !toolbarManager.isOwner(editorId) || !keepToolbarVisibleRef.current) return;
        const { from, to, empty } = editor.state.selection;
        if (empty || from === to) return;
        positionToolbar(from, to);
      });
    };

    const editorDom = editor.view.dom;
    const scrollableParent =
      editorDom.closest('[data-scrollable="true"]') || editorDom.parentElement;

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("scroll", handleScroll, true);
    if (
      scrollableParent &&
      scrollableParent !== document.body &&
      scrollableParent !== document.documentElement
    ) {
      scrollableParent.addEventListener("scroll", handleScroll);
    }

    editor.on("selectionUpdate", () => {
      if (!isMouseDown) handleSelectionUpdate();
    });

    el.style.display = "none";
    setBubbleReady(true);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("scroll", handleScroll, true);
      if (
        scrollableParent &&
        scrollableParent !== document.body &&
        scrollableParent !== document.documentElement
      ) {
        scrollableParent.removeEventListener("scroll", handleScroll);
      }
      toolbarManager.releaseToolbar(editorId);
      bubbleElRef.current = null;
      setBubbleReady(false);
    };
  }, [editor, editorId]);

  if (!editor) return <div className="rte-content" />;

  // Derived from live editor state — always reflects active formatting
  const activeTextColor =
    (editor.getAttributes("textStyle").color as string | undefined) ?? "#000000";
  const activeHighlightColor =
    (editor.getAttributes("highlight").color as string | undefined) ?? "#fef08a";

  const toolbar = (
    <div className="rte-toolbar-modern" role="toolbar" aria-label="Formatting toolbar">
      {/* Text Formatting Group */}
      <div className="rte-toolbar-group">
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("bold") ? " active" : ""}`}
          title="Bold (Ctrl+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
          </svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("italic") ? " active" : ""}`}
          title="Italic (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="4" x2="10" y2="4" />
            <line x1="14" y1="20" x2="5" y2="20" />
            <line x1="15" y1="4" x2="9" y2="20" />
          </svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("underline") ? " active" : ""}`}
          title="Underline (Ctrl+U)"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
            <line x1="4" y1="21" x2="20" y2="21" />
          </svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("strike") ? " active" : ""}`}
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 4H9a3 3 0 0 0-2.83 4" />
            <path d="M14 12a4 4 0 0 1 0 8H6" />
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("code") ? " active" : ""}`}
          title="Inline code"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
      </div>

      <div className="rte-toolbar-divider" />

      {/* Headings & Styles Group */}
      <div className="rte-toolbar-group">
        <div className="rte-dropdown">
          <button
            ref={headingBtnRef}
            type="button"
            className="rte-btn-dropdown"
            title="Text style"
            onClick={() => setShowHeadingMenu(!showHeadingMenu)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12h8" />
              <path d="M4 18V6" />
              <path d="M12 18V6" />
              <path d="M17 12h3" />
              <path d="M17 18V6" />
              <path d="M20 18V6" />
            </svg>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <DropdownPortal
            triggerRef={headingBtnRef}
            isOpen={showHeadingMenu}
            className="rte-dropdown-menu"
          >
            <button
              onClick={() => {
                editor.chain().focus().setParagraph().run();
                setShowHeadingMenu(false);
              }}
            >
              Paragraph
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
                setShowHeadingMenu(false);
              }}
            >
              Heading 1
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
                setShowHeadingMenu(false);
              }}
            >
              Heading 2
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 3 }).run();
                setShowHeadingMenu(false);
              }}
            >
              Heading 3
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 4 }).run();
                setShowHeadingMenu(false);
              }}
            >
              Heading 4
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 5 }).run();
                setShowHeadingMenu(false);
              }}
            >
              Heading 5
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 6 }).run();
                setShowHeadingMenu(false);
              }}
            >
              Heading 6
            </button>
          </DropdownPortal>
        </div>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("blockquote") ? " active" : ""}`}
          title="Blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
          </svg>
        </button>
      </div>

      <div className="rte-toolbar-divider" />

      {/* Lists Group */}
      <div className="rte-toolbar-group">
        <button
          type="button"
          className={`rte-btn-icon${isInList("bulletList") ? " active" : ""}`}
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${isInList("orderedList") ? " active" : ""}`}
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h1v4" />
            <path d="M4 10h2" />
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
          </svg>
        </button>
      </div>

      <div className="rte-toolbar-divider" />

      {/* Insert Group */}
      <div className="rte-toolbar-group">
        <div className="rte-dropdown">
          <button
            ref={linkBtnRef}
            type="button"
            className={`rte-btn-icon${editor.isActive("link") ? " active" : ""}`}
            title={editor.isActive("link") ? "Edit link" : "Add link"}
            onClick={() => setShowLinkInput(!showLinkInput)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
          <DropdownPortal
            triggerRef={linkBtnRef}
            isOpen={showLinkInput}
            className="rte-link-input-panel"
          >
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setLink()}
              autoFocus
            />
            <button onClick={setLink} className="rte-link-btn-apply">
              ✓
            </button>
            {editor.isActive("link") && (
              <button onClick={removeLink} className="rte-link-btn-remove" title="Remove link">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </DropdownPortal>
        </div>
        <div className="rte-dropdown">
          <button
            ref={imageBtnRef}
            type="button"
            className="rte-btn-icon"
            title="Insert image"
            onClick={() => setShowImageInput(!showImageInput)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <DropdownPortal
            triggerRef={imageBtnRef}
            isOpen={showImageInput}
            className="rte-link-input-panel"
          >
            <input
              type="url"
              placeholder="Image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && insertImage()}
              autoFocus
            />
            <button onClick={insertImage} className="rte-link-btn-apply">
              ✓
            </button>
          </DropdownPortal>
        </div>
        <button type="button" className="rte-btn-icon" title="Insert table" onClick={insertTable}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
        </button>
        <button
          type="button"
          className="rte-btn-icon"
          title="Horizontal divider"
          onClick={insertHorizontalRule}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
        </button>
      </div>

      <div className="rte-toolbar-divider" />

      {/* Color Group — A (text color) + H (highlight) */}
      <div className="rte-toolbar-group">
        <div className="rte-dropdown">
          <button
            ref={textColorBtnRef}
            type="button"
            className="rte-btn-text-color"
            title="Text color"
            onClick={() => {
              setShowTextColorPicker(!showTextColorPicker);
              setShowHighlightPicker(false);
            }}
          >
            <span className="rte-btn-color-letter" style={{ color: activeTextColor }}>
              A
            </span>
            <span className="rte-color-indicator-bar" style={{ background: activeTextColor }} />
          </button>
          <DropdownPortal
            triggerRef={textColorBtnRef}
            isOpen={showTextColorPicker}
            className="rte-color-picker-panel"
          >
            <div className="rte-color-preset-row">
              {TEXT_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="rte-color-preset-swatch"
                  style={{ background: c }}
                  title={c}
                  onClick={() => {
                    setColor(c);
                    setShowTextColorPicker(false);
                  }}
                />
              ))}
            </div>
            <div className="rte-color-picker-row">
              <button
                type="button"
                className="rte-color-preset-swatch rte-color-swatch-clear"
                title="Remove color"
                onClick={() => {
                  setColor("");
                  setShowTextColorPicker(false);
                }}
              />
              <input
                type="color"
                className="rte-custom-color-picker-input"
                defaultValue={activeTextColor}
                onChange={(e) => setColor(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                title="Custom color"
              />
            </div>
          </DropdownPortal>
        </div>

        <div className="rte-dropdown">
          <button
            ref={highlightBtnRef}
            type="button"
            className="rte-btn-highlight-color"
            title="Highlight color"
            onClick={() => {
              setShowHighlightPicker(!showHighlightPicker);
              setShowTextColorPicker(false);
            }}
          >
            <span className="rte-btn-color-letter" style={{ background: activeHighlightColor }}>
              H
            </span>
          </button>
          <DropdownPortal
            triggerRef={highlightBtnRef}
            isOpen={showHighlightPicker}
            className="rte-color-picker-panel"
          >
            <div className="rte-color-preset-row">
              {HIGHLIGHT_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="rte-color-preset-swatch"
                  style={{ background: c }}
                  title={c}
                  onClick={() => {
                    setHighlight(c);
                    setShowHighlightPicker(false);
                  }}
                />
              ))}
            </div>
            <div className="rte-color-picker-row">
              <button
                type="button"
                className="rte-color-preset-swatch rte-color-swatch-clear"
                title="Remove highlight"
                onClick={() => {
                  setHighlight("");
                  setShowHighlightPicker(false);
                }}
              />
              <input
                type="color"
                className="rte-custom-color-picker-input"
                defaultValue={activeHighlightColor}
                onChange={(e) => setHighlight(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                title="Custom highlight"
              />
            </div>
          </DropdownPortal>
        </div>
      </div>

      {/* AI button — square, toggles panel below */}
      {onRegenerateSelection && (
        <>
          <div className="rte-toolbar-divider" />
          <div className="rte-toolbar-group">
            <button
              type="button"
              className={`rte-btn-ai${showRegenPrompt ? " active" : ""}`}
              title="Regenerate selection with AI"
              disabled={regenLoading}
              onClick={handleAiButtonClick}
            >
              AI
            </button>
          </div>
        </>
      )}
    </div>
  );

  // AI input panel — appears below toolbar when AI button is toggled
  const aiInputPanel =
    onRegenerateSelection && showRegenPrompt ? (
      <div className="rte-ai-input-panel">
        <Input
          inputSize="sm"
          placeholder="How should AI improve this?"
          value={regenPrompt}
          onChange={(e) => setRegenPrompt(e.target.value)}
          onKeyDown={handleRegenKeyDown}
          autoFocus
          disabled={regenLoading}
        />
        <button
          type="button"
          className="rte-ai-send-btn"
          onClick={() => void handleRegenerateSubmit()}
          disabled={regenLoading}
          title="Submit (Enter)"
        >
          {regenLoading ? (
            <svg
              className="rte-spinner"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          )}
        </button>
      </div>
    ) : null;

  const toolbarWithPanel = (
    // onMouseDown prevents editor blur when interacting with the floating toolbar
    <div className="rte-toolbar-container-floating" onMouseDown={(e) => e.preventDefault()}>
      {toolbar}
      {aiInputPanel}
    </div>
  );

  return (
    <div className="rte-wrapper">
      {bubbleReady &&
        hasSelection &&
        bubbleElRef.current &&
        createPortal(toolbarWithPanel, bubbleElRef.current)}
      <div className="rte-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
