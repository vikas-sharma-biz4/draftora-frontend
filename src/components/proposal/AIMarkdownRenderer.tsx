"use client";

import { memo, Children, isValidElement, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";

interface AIMarkdownRendererProps {
  /** AI-generated plain-text or markdown content. */
  content: string;
}

/**
 * Post-process markdown content to fix common formatting issues.
 * Specifically fixes similar_projects section formatting problems:
 * 1. Description on same line as heading → move to new line
 * 2. No blank line after heading → add blank line
 * 3. Leading space before "Key Highlights:" → remove leading space
 * 4. Bullet points on same line → split into separate lines
 * 5. No blank line between projects → add blank line
 */
function fixMarkdownFormatting(content: string): string {
  let fixed = content;

  // Fix 1: Ensure heading is on its own line (description should not be on same line)
  // Pattern: ### **[Title](URL)** Description → ### **[Title](URL)**\nDescription
  fixed = fixed.replace(/^(###\s+\*\*[^*]+\*\*)\s+(.+)$/gm, "$1\n$2");

  // Fix 2: Ensure blank line after heading (only for level-3 headings)
  // Pattern: ### Heading\nDescription → ### Heading\n\nDescription
  fixed = fixed.replace(/^(###\s+.+)$/gm, "$1\n");

  // Fix 3: Remove leading space before "Key Highlights:"
  fixed = fixed.replace(/^\s+Key Highlights:/gm, "Key Highlights:");

  // Fix 4: Split bullet points that are on the same line after "Key Highlights:"
  // Pattern: Key Highlights:\n- Item1 - Item2 - Item3 → Key Highlights:\n- Item1\n- Item2\n- Item3
  fixed = fixed
    .replace(/^(Key Highlights:\s*)$/gm, "$1\n")
    .replace(/(-\s+[^-\n]+)(\s+-\s+)/g, "$1\n$2");

  // Fix 5: Add blank line before each new project heading (###)
  // Pattern: - Bullet\n### Next Project → - Bullet\n\n### Next Project
  fixed = fixed.replace(/(-\s+[^\n]+)\n(###\s+)/g, "$1\n\n$2");

  return fixed;
}

/** Stable component map — defined outside the render function so
 *  React.memo's shallow comparison never sees a new object reference,
 *  which prevents unnecessary remounts / flicker. */
const MD_COMPONENTS: Components = {
  h1: ({ children }) => <h1 className="ai-md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="ai-md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="ai-md-h3">{children}</h3>,
  p: ({ children }) => {
    const childArray = Children.toArray(children);
    const first = childArray[0];

    if (typeof first === "string") {
      const trimmed = first.trimStart();

      // ==Note:== pattern → full yellow-highlight paragraph
      if (trimmed.startsWith("==Note:==")) {
        const text = trimmed.replace(/^==Note:==\s*/, "");
        return (
          <p className="ai-md-p ai-note-yellow">
            <strong className="ai-note-heading">Note:</strong>
            {text ? ` ${text}` : ""}
            {childArray.slice(1)}
          </p>
        );
      }

      // ==Additional Costs for APIs:== pattern → inline yellow label
      if (trimmed.startsWith("==Additional Costs for APIs:==")) {
        const text = trimmed.replace(/^==Additional Costs for APIs:==\s*/, "");
        return (
          <p className="ai-md-p">
            <mark className="ai-note-label">
              <strong>Additional Costs for APIs:</strong>
            </mark>
            {text ? ` ${text}` : ""}
            {childArray.slice(1)}
          </p>
        );
      }
    }

    // Design cost line — bold or plain paragraph with $200/screen
    const fullText = childArray
      .map((c) => {
        if (typeof c === "string") return c;
        if (isValidElement(c)) {
          const el = c as ReactElement<{ children?: unknown }>;
          return typeof el.props.children === "string" ? el.props.children : "";
        }
        return "";
      })
      .join("");

    if (fullText.includes("$200/screen") || fullText.toLowerCase().includes("cost for design is")) {
      return <p className="ai-md-p ai-note-dark">{children}</p>;
    }

    return <p className="ai-md-p">{children}</p>;
  },
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
    <a className="ai-md-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <div style={{ display: "flex", justifyContent: "center", margin: "1.5rem 0" }}>
      <img
        src={src}
        alt={alt || ""}
        style={{
          maxWidth: "100%",
          height: "auto",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          display: "block",
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  ),
  blockquote: ({ children }) => <blockquote className="ai-md-blockquote">{children}</blockquote>,
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
  const processedContent = fixMarkdownFormatting(content);

  return (
    <div className="markdown-output" suppressHydrationWarning>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={MD_COMPONENTS}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

export default AIMarkdownRenderer;
