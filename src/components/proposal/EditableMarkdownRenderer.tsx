/**
 * @deprecated DO NOT USE THIS COMPONENT
 * 
 * This component is DEPRECATED and causes critical UI issues:
 * - Layout shift on click
 * - Re-render cascade
 * - Markdown flickering
 * - Cursor loss
 * - Selection state conflicts
 * 
 * ROOT CAUSES:
 * 1. onClick triggers state change (setIsEditing) → re-render
 * 2. contentEditable on ReactMarkdown output = anti-pattern
 * 3. Selection stored in React state → unnecessary re-renders
 * 4. Toolbar position updates trigger state changes
 * 
 * REPLACEMENT:
 * Use SectionViewMode + SectionEditMode with explicit mode switching
 * via ProposalSectionEditor component.
 * 
 * SCHEDULED FOR REMOVAL: Next cleanup cycle
 */

"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";
import TurndownService from "turndown";
import FormattingToolbar from "./FormattingToolbar";

interface EditableMarkdownRendererProps {
  content: string;
  onChange: (markdown: string) => void;
  onRegenerateSelection?: (selectedText: string) => void;
}

const MD_COMPONENTS: Components = {
  h1: ({ children }) => <h1 className="ai-md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="ai-md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="ai-md-h3">{children}</h3>,
  p: ({ children }) => <p className="ai-md-p">{children}</p>,
  strong: ({ children }) => <strong className="ai-md-strong">{children}</strong>,
  em: ({ children }) => <em className="ai-md-em">{children}</em>,
  ul: ({ children }) => <ul className="ai-md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="ai-md-ol">{children}</ol>,
  li: ({ children }) => <li className="ai-md-li">{children}</li>,
  table: ({ children }) => (
    <div className="ai-md-table-wrapper">
      <table className="ai-md-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="ai-md-thead">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="ai-md-tr">{children}</tr>,
  th: ({ children }) => <th className="ai-md-th">{children}</th>,
  td: ({ children }) => <td className="ai-md-td">{children}</td>,
  a: ({ href, children }) => (
    <a
      className="ai-md-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="ai-md-blockquote">{children}</blockquote>
  ),
  code: ({ children }) => <code className="ai-md-code">{children}</code>,
  hr: () => <hr className="ai-md-hr" />,
};

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

const EditableMarkdownRenderer = memo(function EditableMarkdownRenderer({
  content,
  onChange,
  onRegenerateSelection,
}: EditableMarkdownRendererProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
      setShowToolbar(false);
      setSelectedText("");
      return;
    }

    if (!containerRef.current?.contains(selection.anchorNode)) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const text = selection.toString();

    setToolbarPosition({
      top: rect.top - 50,
      left: rect.left + rect.width / 2,
    });

    setSelectedText(text);
    setShowToolbar(true);
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [handleSelection]);

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    if (!containerRef.current) return;

    const html = containerRef.current.innerHTML;
    const markdown = turndownService.turndown(html);

    onChange(markdown);
    setIsEditing(false);
    setShowToolbar(false);
  }, [onChange]);

  const applyFormat = useCallback((formatType: string) => {
    document.execCommand(formatType, false, undefined);
  }, []);

  const handleRegenerate = useCallback(() => {
    if (selectedText && onRegenerateSelection) {
      onRegenerateSelection(selectedText);
      setShowToolbar(false);
    }
  }, [selectedText, onRegenerateSelection]);

  return (
    <>
      <div
        ref={containerRef}
        className={`editable-markdown-container${isEditing ? " editing" : ""}`}
        contentEditable={isEditing}
        suppressContentEditableWarning={true}
        onClick={handleClick}
        onBlur={handleBlur}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={MD_COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      </div>

      {showToolbar && (
        <FormattingToolbar
          position={toolbarPosition}
          onFormat={applyFormat}
          onRegenerate={onRegenerateSelection ? handleRegenerate : undefined}
        />
      )}
    </>
  );
});

export default EditableMarkdownRenderer;
