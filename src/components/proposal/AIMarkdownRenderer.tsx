"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";

interface AIMarkdownRendererProps {
  /** AI-generated plain-text or markdown content. */
  content: string;
}

/** Stable component map — defined outside the render function so
 *  React.memo's shallow comparison never sees a new object reference,
 *  which prevents unnecessary remounts / flicker. */
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

/**
 * Renders AI-generated proposal section content using ReactMarkdown.
 *
 * Supports:
 *   - GitHub Flavoured Markdown (remark-gfm): tables, strikethrough, task lists
 *   - rehype-sanitize: safe HTML output, no XSS risk
 *
 * Wrapped with React.memo so it only re-renders when `content` actually
 * changes — prevents flicker caused by parent state updates unrelated to
 * this section's content.
 *
 * dangerouslySetInnerHTML is NEVER used here.
 * Static HTML sections always bypass this component and use ContentRenderer.
 */
const AIMarkdownRenderer = memo(function AIMarkdownRenderer({
  content,
}: AIMarkdownRendererProps): JSX.Element {
  return (
    <div className="markdown-output" suppressHydrationWarning>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={MD_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default AIMarkdownRenderer;
