"use client";

import { memo, useEffect, useState, useCallback, useRef, useId } from "react";
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

import { EDITOR_HIGHLIGHT_COLORS, EDITOR_TEXT_COLORS } from "@/constants";

interface RegenerateSelectionParams {
  selectedText: string;
  selectionRange: { from: number; to: number };
  instructions?: string;
}

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Called when user submits regeneration with selection context and instructions. */
  onRegenerateSelection?: (params: RegenerateSelectionParams) => Promise<string | null>;
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
    <div ref={elRef} className={className}>
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
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState<boolean>(true);
  const [showCustomTextColorPicker, setShowCustomTextColorPicker] = useState<boolean>(false);
  const [showCustomHighlightPicker, setShowCustomHighlightPicker] = useState<boolean>(false);
  const headingBtnRef = useRef<HTMLButtonElement | null>(null);
  const linkBtnRef = useRef<HTMLButtonElement | null>(null);
  const imageBtnRef = useRef<HTMLButtonElement | null>(null);
  const customTextBtnRef = useRef<HTMLButtonElement | null>(null);
  const customHighlightBtnRef = useRef<HTMLButtonElement | null>(null);

  // Unique ID for this editor instance (for toolbar ownership)
  const editorId = useId();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
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
        HTMLAttributes: {
          class: 'proposal-image',
        },
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
    // Don't auto-focus - cursor appears only when user clicks
  });

  // Update content when it changes externally without re-creating the editor
  // Only update if content is significantly different (not just formatting changes)
  useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    const newContent = content;

    // Don't update if content is the same or if editor is focused (user is typing)
    if (currentHtml === newContent || editor.isFocused) {
      return;
    }

    // Only update if content changed externally (e.g., from regeneration)
    // emitUpdate: false prevents triggering onChange during external updates
    editor.commands.setContent(newContent, { emitUpdate: false });
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
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  const setLink = useCallback((): void => {
    if (!editor) return;
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setShowLinkInput(false);
    }
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

  const openRegenPrompt = useCallback((): void => {
    if (!editor) return;
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

    setRegenLoading(true);
    try {
      const regeneratedContent = await onRegenerateSelection({
        selectedText,
        selectionRange: { from, to },
        instructions: regenPrompt.trim() || undefined,
      });

      if (regeneratedContent !== null && editor) {
        // Replace content at exact selection position using TipTap transaction
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .insertContent(regeneratedContent)
          .run();
      }
    } catch (error) {
      console.error("[RichEditor] Regeneration failed:", error);
    } finally {
      setRegenLoading(false);
      closeRegenPrompt();
    }
  }, [editor, onRegenerateSelection, savedSelection, regenPrompt, closeRegenPrompt]);

  const handleRegenKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleRegenerateSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeRegenPrompt();
    }
  }, [handleRegenerateSubmit, closeRegenPrompt]);

  const bubbleElRef = useRef<HTMLDivElement | null>(null);
  const [bubbleReady, setBubbleReady] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectionCoords, setSelectionCoords] = useState({ top: 0, left: 0 });
  const keepToolbarVisibleRef = useRef<boolean>(false);
  const toolbarPositionSetRef = useRef<boolean>(false);

  useEffect(() => {
    if (!editor) return;

    // Cleanup function to reset all toolbar state
    const cleanupToolbarState = () => {
      setShowRegenPrompt(false);
      setRegenPrompt("");
      setSavedSelection(null);
      setShowHeadingMenu(false);
      setShowLinkInput(false);
      setShowImageInput(false);
      setIsToolbarCollapsed(true);
      setHasSelection(false);
      setShowCustomTextColorPicker(false);
      setShowCustomHighlightPicker(false);
    };

    // Request toolbar ownership from centralized manager
    const el = toolbarManager.requestToolbar(editorId, cleanupToolbarState);
    bubbleElRef.current = el;

    const handleSelectionUpdate = () => {
      const { from, to, empty } = editor.state.selection;
      const hasTextSelected = !empty && from !== to;

      if (hasTextSelected) {
        // CRITICAL: Only proceed if this editor owns the toolbar
        // This prevents multiple editors from fighting over the same toolbar
        if (!toolbarManager.isOwner(editorId)) {
          // Request ownership - this will cleanup any other editor's toolbar
          toolbarManager.requestToolbar(editorId, cleanupToolbarState);
        }

        // CRITICAL: Reset ALL toolbar UI state for EVERY new selection
        // This ensures clean toolbar state and prevents any menus/panels from auto-opening
        setShowRegenPrompt(false);
        setRegenPrompt("");
        setSavedSelection(null);
        setShowHeadingMenu(false);
        setShowLinkInput(false);
        setShowImageInput(false);
        setIsToolbarCollapsed(true); // Start collapsed by default
        setShowCustomTextColorPicker(false);
        setShowCustomHighlightPicker(false);

        setHasSelection(true);
        keepToolbarVisibleRef.current = true; // Mark toolbar as active

        // Only calculate and set position for NEW selections (not during scroll)
        if (!toolbarPositionSetRef.current && el && toolbarManager.isOwner(editorId)) {
          // Get selection coordinates from the editor view (already viewport-relative)
          const startCoords = editor.view.coordsAtPos(from);
          const endCoords = editor.view.coordsAtPos(to);

          // Calculate center of selection
          const top = endCoords.bottom + 2; // 2px below end of selection
          let left = (startCoords.left + endCoords.left) / 2; // Center horizontally

          setSelectionCoords({ top, left });

          // Position and show the bubble with viewport boundary detection
          el.style.position = 'fixed';
          el.style.top = `${top}px`;
          el.style.left = `${left}px`;
          el.style.display = 'block'; // Must be visible to measure width

          // Get toolbar dimensions after rendering
          const toolbarWidth = el.offsetWidth || 320;
          const viewportWidth = window.innerWidth;
          const padding = 12; // Minimum padding from viewport edges

          // Calculate boundaries - toolbar should not go off screen
          // With translateX(-50%), the actual left edge is at: left - (toolbarWidth / 2)
          // The actual right edge is at: left + (toolbarWidth / 2)
          const toolbarHalfWidth = toolbarWidth / 2;
          const minLeft = padding + toolbarHalfWidth;
          const maxLeft = viewportWidth - padding - toolbarHalfWidth;

          // Constrain left position to keep toolbar on screen
          if (left < minLeft) {
            left = minLeft;
          } else if (left > maxLeft) {
            left = maxLeft;
          }

          el.style.left = `${left}px`;
          el.style.transform = 'translateX(-50%)'; // Center the toolbar on the calculated position

          // Mark position as set - don't recalculate until new selection
          toolbarPositionSetRef.current = true;
        }
      } else if (!keepToolbarVisibleRef.current) {
        // Only hide if we're not keeping it visible (e.g., during scroll)
        setHasSelection(false);
        // Reset ALL toolbar UI state when selection is cleared
        setShowRegenPrompt(false);
        setRegenPrompt("");
        setSavedSelection(null);
        setShowHeadingMenu(false);
        setShowLinkInput(false);
        setShowImageInput(false);
        setIsToolbarCollapsed(true);
        setShowCustomTextColorPicker(false);
        setShowCustomHighlightPicker(false);
        // Hide the bubble
        if (el) {
          el.style.display = 'none';
        }
      }
      // If keepToolbarVisibleRef.current is true and no selection, toolbar stays visible
    };

    // Track mouse state to only show toolbar after mouse is released
    let isMouseDown = false;

    const handleMouseDown = (e: MouseEvent) => {
      // Don't reset if clicking on the toolbar or regen panel
      const target = e.target as Node;
      if (el && el.contains(target)) {
        return; // Clicking on toolbar - do nothing
      }

      // Only track mouse down if clicking inside the editor, not on the toolbar
      const editorDom = editor.view.dom;
      if (editorDom.contains(target)) {
        isMouseDown = true;
        keepToolbarVisibleRef.current = false; // Reset flag - user is making new selection
        toolbarPositionSetRef.current = false; // Reset position flag - allow repositioning
        // CRITICAL: Reset ALL toolbar state immediately when starting new selection
        // This prevents multiple toolbars and ensures clean state
        setShowRegenPrompt(false);
        setRegenPrompt("");
        setSavedSelection(null);
        setShowHeadingMenu(false);
        setShowLinkInput(false);
        setShowImageInput(false);
        setIsToolbarCollapsed(true);
        setHasSelection(false);
        setShowCustomTextColorPicker(false);
        setShowCustomHighlightPicker(false);
        // Hide toolbar when starting to select
        if (el) {
          el.style.display = 'none';
        }
      } else {
        // Clicking outside editor - reset flags to allow toolbar to hide
        keepToolbarVisibleRef.current = false;
        toolbarPositionSetRef.current = false;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Only handle mouse up if we were tracking a selection in the editor
      if (isMouseDown) {
        isMouseDown = false;
        // Show toolbar after mouse is released and selection is complete
        setTimeout(() => handleSelectionUpdate(), 50); // Longer delay to ensure selection is complete
      }
    };

    // Handle scroll to update toolbar position
    const handleScroll = () => {
      requestAnimationFrame(() => {
        if (!el || !toolbarManager.isOwner(editorId) || !keepToolbarVisibleRef.current) {
          return;
        }

        // Check if there's an active selection in the editor state
        const { from, to, empty } = editor.state.selection;
        if (empty || from === to) return;

        // Get updated selection coordinates
        const startCoords = editor.view.coordsAtPos(from);
        const endCoords = editor.view.coordsAtPos(to);

        // Recalculate position
        const top = endCoords.bottom + 2;
        let left = (startCoords.left + endCoords.left) / 2;

        // Apply boundary detection
        const toolbarWidth = el.offsetWidth || 320;
        const viewportWidth = window.innerWidth;
        const padding = 12;
        const toolbarHalfWidth = toolbarWidth / 2;
        const minLeft = padding + toolbarHalfWidth;
        const maxLeft = viewportWidth - padding - toolbarHalfWidth;

        if (left < minLeft) {
          left = minLeft;
        } else if (left > maxLeft) {
          left = maxLeft;
        }

        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
        el.style.display = 'block'; // Ensure toolbar is visible
      });
    };

    // Attach scroll listener to the editor's scrollable parent and window
    const editorDom = editor.view.dom;
    const scrollableParent = editorDom.closest('[data-scrollable="true"]') || editorDom.parentElement;

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('scroll', handleScroll, true); // Capture phase for all scroll events
    if (scrollableParent && scrollableParent !== document.body && scrollableParent !== document.documentElement) {
      scrollableParent.addEventListener('scroll', handleScroll);
    }

    // Also handle keyboard selection (no mouse involved)
    editor.on('selectionUpdate', () => {
      if (!isMouseDown) {
        handleSelectionUpdate();
      }
    });

    // Initial state - hidden
    el.style.display = 'none';
    setBubbleReady(true);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('scroll', handleScroll, true);
      if (scrollableParent && scrollableParent !== document.body && scrollableParent !== document.documentElement) {
        scrollableParent.removeEventListener('scroll', handleScroll);
      }

      // Release toolbar ownership - manager will handle cleanup
      toolbarManager.releaseToolbar(editorId);

      bubbleElRef.current = null;
      setBubbleReady(false);
    };
  }, [editor, editorId]);

  if (!editor) return <div className="rte-content" />;

  const toolbar = (
    <div className={`rte-toolbar-modern${isToolbarCollapsed ? " collapsed" : ""}`} role="toolbar" aria-label="Formatting toolbar">
      {/* Text Formatting Group */}
      <div className="rte-toolbar-group">
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("bold") ? " active" : ""}`}
          title="Bold (Ctrl+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("italic") ? " active" : ""}`}
          title="Italic (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("underline") ? " active" : ""}`}
          title="Underline (Ctrl+U)"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("strike") ? " active" : ""}`}
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("code") ? " active" : ""}`}
          title="Inline code"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12h3"/><path d="M17 18V6"/><path d="M20 18V6"/></svg>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <DropdownPortal triggerRef={headingBtnRef} isOpen={showHeadingMenu} className="rte-dropdown-menu">
            <button onClick={() => { editor.chain().focus().setParagraph().run(); setShowHeadingMenu(false); }}>Paragraph</button>
            <button onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setShowHeadingMenu(false); }}>Heading 1</button>
            <button onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setShowHeadingMenu(false); }}>Heading 2</button>
            <button onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setShowHeadingMenu(false); }}>Heading 3</button>
            <button onClick={() => { editor.chain().focus().toggleHeading({ level: 4 }).run(); setShowHeadingMenu(false); }}>Heading 4</button>
            <button onClick={() => { editor.chain().focus().toggleHeading({ level: 5 }).run(); setShowHeadingMenu(false); }}>Heading 5</button>
            <button onClick={() => { editor.chain().focus().toggleHeading({ level: 6 }).run(); setShowHeadingMenu(false); }}>Heading 6</button>
          </DropdownPortal>
        </div>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("blockquote") ? " active" : ""}`}
          title="Blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
        </button>
      </div>

      <div className="rte-toolbar-divider" />

      {/* Lists Group */}
      <div className="rte-toolbar-group">
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("bulletList") ? " active" : ""}`}
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
        <button
          type="button"
          className={`rte-btn-icon${editor.isActive("orderedList") ? " active" : ""}`}
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
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
            onClick={() => {
              if (editor.isActive("link")) {
                setShowLinkInput(!showLinkInput);
              } else {
                setShowLinkInput(!showLinkInput);
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <DropdownPortal triggerRef={linkBtnRef} isOpen={showLinkInput} className="rte-link-input-panel">
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setLink()}
              autoFocus
            />
            <button onClick={setLink} className="rte-link-btn-apply">✓</button>
            {editor.isActive("link") && (
              <button onClick={removeLink} className="rte-link-btn-remove" title="Remove link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <DropdownPortal triggerRef={imageBtnRef} isOpen={showImageInput} className="rte-link-input-panel">
            <input
              type="url"
              placeholder="Image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && insertImage()}
              autoFocus
            />
            <button onClick={insertImage} className="rte-link-btn-apply">✓</button>
          </DropdownPortal>
        </div>
        <button
          type="button"
          className="rte-btn-icon"
          title="Insert table"
          onClick={insertTable}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
        </button>
        <button
          type="button"
          className="rte-btn-icon"
          title="Horizontal divider"
          onClick={insertHorizontalRule}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>
        </button>
      </div>

      <div className="rte-toolbar-divider" />

      {/* Color Group */}
      <div className="rte-toolbar-group rte-color-group">
        <span className="rte-color-label">Highlight</span>
        {EDITOR_HIGHLIGHT_COLORS.map((color) => (
          color === "custom" ? (
            <div key="custom" className="rte-dropdown">
              <button
                ref={customHighlightBtnRef}
                type="button"
                className="rte-color-swatch-btn"
                title="Custom highlight color"
                onClick={() => {
                  setShowCustomHighlightPicker(!showCustomHighlightPicker);
                  setShowCustomTextColorPicker(false);
                }}
              >
                <div className="rte-color-swatch rte-color-swatch-custom">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M2 12h20"/>
                  </svg>
                </div>
              </button>
              {showCustomHighlightPicker && (
                <DropdownPortal
                  triggerRef={customHighlightBtnRef}
                  isOpen={showCustomHighlightPicker}
                  className="rte-custom-color-picker-portal"
                >
                  <input
                    type="color"
                    className="rte-custom-color-picker-input"
                    onChange={(e) => {
                      setHighlight(e.target.value);
                      setShowCustomHighlightPicker(false);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                </DropdownPortal>
              )}
            </div>
          ) : (
            <button
              key={color || "none"}
              type="button"
              className="rte-color-swatch-btn"
              title={color ? `Highlight: ${color}` : "Remove highlight"}
              onClick={() => setHighlight(color)}
            >
              <div
                className={`rte-color-swatch${color ? "" : " rte-color-swatch-empty"}`}
                style={color ? { background: color } : undefined}
              />
            </button>
          )
        ))}
      </div>

      <div className="rte-toolbar-divider" />

      <div className="rte-toolbar-group rte-color-group">
        <span className="rte-color-label">Text</span>
        {EDITOR_TEXT_COLORS.map((color) => (
          color === "custom" ? (
            <div key="custom" className="rte-dropdown">
              <button
                ref={customTextBtnRef}
                type="button"
                className="rte-color-swatch-btn"
                title="Custom text color"
                onClick={() => {
                  setShowCustomTextColorPicker(!showCustomTextColorPicker);
                  setShowCustomHighlightPicker(false);
                }}
              >
                <div className="rte-color-swatch rte-color-swatch-custom">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M2 12h20"/>
                  </svg>
                </div>
              </button>
              {showCustomTextColorPicker && (
                <DropdownPortal
                  triggerRef={customTextBtnRef}
                  isOpen={showCustomTextColorPicker}
                  className="rte-custom-color-picker-portal"
                >
                  <input
                    type="color"
                    className="rte-custom-color-picker-input"
                    onChange={(e) => {
                      setColor(e.target.value);
                      setShowCustomTextColorPicker(false);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                </DropdownPortal>
              )}
            </div>
          ) : (
            <button
              key={color || "none"}
              type="button"
              className="rte-color-swatch-btn"
              title={color ? `Color: ${color}` : "Default color"}
              onClick={() => setColor(color)}
            >
              <div
                className={`rte-color-swatch${color ? "" : " rte-color-swatch-empty"}`}
                style={color ? { background: color } : undefined}
              />
            </button>
          )
        ))}
      </div>

      {/* AI Regenerate - Always visible in toolbar row */}
      {onRegenerateSelection && (
        <>
          <div className="rte-toolbar-divider" />
          {showRegenPrompt ? (
            <input
              type="text"
              className="rte-regen-input-inline"
              placeholder="How should AI rewrite this?"
              value={regenPrompt}
              onChange={(e) => setRegenPrompt(e.target.value)}
              onKeyDown={handleRegenKeyDown}
              autoFocus
              disabled={regenLoading}
            />
          ) : (
            <button
              type="button"
              className="rte-btn-ai"
              title="Regenerate selection with AI"
              disabled={regenLoading}
              onClick={openRegenPrompt}
            >
              <span>AI</span>
            </button>
          )}
        </>
      )}

      {/* Expand/Collapse Button */}
      <button
        type="button"
        className="rte-toolbar-expand-btn"
        title={isToolbarCollapsed ? "Show more options" : "Show less options"}
        onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
      >
        {isToolbarCollapsed ? (
          <>
            <span>More</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </>
        ) : (
          <>
            <span>Less</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
          </>
        )}
      </button>
    </div>
  );

  // Combined toolbar container
  const toolbarWithPanel = (
    <div className="rte-toolbar-container-floating">
      {toolbar}
    </div>
  );

  return (
    <div className="rte-wrapper">
      {/* Render toolbar + panel into bubble mount via portal when text is selected */}
      {bubbleReady && hasSelection && bubbleElRef.current && createPortal(toolbarWithPanel, bubbleElRef.current)}

      {/* Editor content */}
      <div className="rte-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
