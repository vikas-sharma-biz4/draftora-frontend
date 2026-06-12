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
 * Fix escaped bold markers produced by the LLM: \*\*text\*\* → **text**
 *
 * The LLM occasionally outputs backslash-escaped asterisks (e.g. in table cells
 * for milestone names) which cause remark to render them as literal **text**
 * instead of bold. This restores the intended bold formatting.
 */
function fixEscapedBoldMarkers(content: string): string {
  return content.replace(/\\\*\\\*(.*?)\\\*\\\*/g, "**$1**");
}

/**
 * Fix multiline table rows by merging continuation lines with <br>.
 *
 * remark-gfm requires each table row to be on a single line. When the LLM
 * generates Key Activities cells with soft line breaks (\n) instead of <br>,
 * the table row is split across multiple lines and remark-gfm cannot parse
 * the table — it falls back to rendering the content as paragraphs.
 *
 * Algorithm:
 * 1. After a |---| separator row, the table body starts.
 * 2. Any non-empty line that does NOT start with | is a continuation of the
 *    previous table row — merge it with <br>.
 * 3. An empty line ends the table body context.
 */
function fixTableMultilineRows(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inTableBody = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Separator row (|---|---|) marks the start of the table body
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
      inTableBody = true;
      result.push(line);
      continue;
    }

    // Header or data row — any line starting with |
    if (trimmed.startsWith("|")) {
      result.push(line);
      continue;
    }

    // Non-empty continuation line inside the table body
    if (inTableBody && trimmed.length > 0 && result.length > 0) {
      result[result.length - 1] = result[result.length - 1].trimEnd() + "<br>" + trimmed;
      continue;
    }

    // Empty line exits the table body context
    if (trimmed === "") {
      inTableBody = false;
    }

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Fix ordered list items that all use "1." (LLM reset pattern).
 *
 * Some LLMs consistently output every ordered list item as "1." because
 * standard markdown auto-increments. However, when items are separated by
 * bullet sub-lists or blank lines, ReactMarkdown creates separate <ol>
 * elements that each start at 1, producing "1, 1, 1" instead of "1, 2, 3".
 *
 * This function detects when every ordered item in the content uses "1." and
 * renumbers them sequentially so that a single counter runs across all items.
 */
function fixSteppedOrderedLists(content: string): string {
  const lines = content.split("\n");
  const orderedLines = lines.filter((line) => /^\d+\.\s/.test(line));
  if (orderedLines.length < 2) return content;

  // Only fix when every ordered item starts with "1." — the LLM reset pattern.
  const allStartWith1 = orderedLines.every((line) => /^1\.\s/.test(line));
  if (!allStartWith1) return content;

  let counter = 0;
  return lines
    .map((line) => {
      if (/^1\.\s/.test(line)) {
        counter++;
        return `${counter}. ${line.slice(3)}`;
      }
      return line;
    })
    .join("\n");
}

/**
 * Post-process markdown content to fix common formatting issues.
 *
 * Applied fixes (in order):
 * 1. Escaped bold markers: \*\*text\*\* → **text** (LLM escape artifact)
 * 2. Multiline table rows: continuation lines merged with <br> so remark-gfm
 *    can parse the table (affects POC estimated_timeline and similar sections)
 * 3. Sequential ordered list numbering: all-"1." items renumbered 1,2,3…
 * 4–8. similar_projects section formatting (headings, bullets, blank lines)
 */
function fixMarkdownFormatting(content: string): string {
  let fixed = content;

  // Fix escaped bold markers produced by the LLM
  fixed = fixEscapedBoldMarkers(fixed);

  // Fix multiline table rows (newlines inside cells → <br>)
  fixed = fixTableMultilineRows(fixed);

  // Fix sequential ordered list numbering (all-"1." LLM pattern → 1,2,3…)
  fixed = fixSteppedOrderedLists(fixed);

  // Fix 3: Ensure heading is on its own line (description should not be on same line)
  // Pattern: ### **[Title](URL)** Description → ### **[Title](URL)**\nDescription
  fixed = fixed.replace(/^(###\s+\*\*[^*]+\*\*)\s+(.+)$/gm, "$1\n$2");

  // Fix 4: Ensure blank line after heading (only for level-3 headings)
  // Pattern: ### Heading\nDescription → ### Heading\n\nDescription
  fixed = fixed.replace(/^(###\s+.+)$/gm, "$1\n");

  // Fix 5: Remove leading space before "Key Highlights:"
  fixed = fixed.replace(/^\s+Key Highlights:/gm, "Key Highlights:");

  // Fix 6: Split bullet points that are on the same line after "Key Highlights:"
  // Pattern: Key Highlights:\n- Item1 - Item2 - Item3 → Key Highlights:\n- Item1\n- Item2\n- Item3
  fixed = fixed
    .replace(/^(Key Highlights:\s*)$/gm, "$1\n")
    .replace(/(-\s+[^-\n]+)(\s+-\s+)/g, "$1\n$2");

  // Fix 7: Add blank line before each new project heading (###)
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
