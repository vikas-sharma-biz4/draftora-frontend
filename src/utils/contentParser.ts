/**
 * Content type detection and plain-text-to-HTML conversion.
 *
 * The AI generates content in plain text with markdown-style formatting:
 *   - Tables:      | Col1 | Col2 |
 *   - Bullets:     - item text
 *   - Numbered:    1. item text
 *   - Sub-headings: short line ending with a colon
 *
 * This module detects the content type and provides utilities to convert
 * it to HTML (for TipTap editing) or to structured blocks (for JSX rendering).
 */

/** Section keys that always render a diagram (architecture, flowcharts, etc.). */
export const DIAGRAM_SECTION_KEYS: string[] = [
  "system_architecture",
  "proposed_technology_stack",
  "high_level_scope",
];

/**
 * Prefix marker stored in section content when it contains one or more
 * AI-generated image URLs (Eraser architecture diagram or user-flow chunks).
 * Mirrors the backend IMAGE_SECTION_URL_PREFIX constant.
 */
export const IMAGE_SECTION_URL_PREFIX = "GENERATED_IMAGE::";

/**
 * Return true when the content string holds one or more AI-generated image
 * URLs produced by the Eraser.io or OpenAI image pipeline.
 */
export function isGeneratedImageContent(content: string): boolean {
  return content.startsWith(IMAGE_SECTION_URL_PREFIX);
}

/**
 * Parse a GENERATED_IMAGE:: content string into an ordered list of URLs.
 * Supports pipe-separated multi-image user-flow chunks.
 */
export function parseGeneratedImageUrls(content: string): string[] {
  if (!isGeneratedImageContent(content)) return [];
  return content
    .slice(IMAGE_SECTION_URL_PREFIX.length)
    .split("|")
    .map((u) => u.trim())
    .filter(Boolean);
}

export type SectionContentType = "table" | "bullets" | "diagram" | "paragraph";

/**
 * Detect the rendering type for a proposal section based on its key and content.
 */
export function detectContentType(
  sectionKey: string,
  content: string
): SectionContentType {
  if (DIAGRAM_SECTION_KEYS.includes(sectionKey)) return "diagram";
  if (/^\|.+\|$/m.test(content)) return "table";
  if (/^[-*]\s+/m.test(content) || /^\d+\.\s+/m.test(content)) return "bullets";
  return "paragraph";
}

/** Return true when the string already contains HTML tags. */
export function isHtmlContent(content: string): boolean {
  return /<[a-z][\s\S]*?>/i.test(content);
}

// ---------------------------------------------------------------------------
// Structured block parsing (used by JSX renderers)
// ---------------------------------------------------------------------------

export type ContentBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[]; ordered: boolean };

/**
 * Parse plain-text content into an ordered list of typed blocks.
 * Consecutive bullets/numbered items are grouped into a single block.
 */
export function parseContentBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = content.split("\n");
  let pendingItems: string[] = [];
  let pendingOrdered = false;

  function flushBullets(): void {
    if (pendingItems.length === 0) return;
    blocks.push({
      kind: "bullets",
      items: [...pendingItems],
      ordered: pendingOrdered,
    });
    pendingItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (pendingItems.length > 0 && pendingOrdered) flushBullets();
      pendingOrdered = false;
      pendingItems.push(bulletMatch[1]);
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (pendingItems.length > 0 && !pendingOrdered) flushBullets();
      pendingOrdered = true;
      pendingItems.push(numberedMatch[1]);
      continue;
    }

    flushBullets();

    // Sub-heading: short line ending with colon, no sentence period
    if (trimmed.endsWith(":") && trimmed.length <= 80 && !trimmed.includes(".")) {
      blocks.push({ kind: "heading", text: trimmed });
      continue;
    }

    // Regular paragraph — strip raw markdown asterisks
    const clean = trimmed.replace(/\*\*/g, "").replace(/\*/g, "");
    blocks.push({ kind: "paragraph", text: clean });
  }

  flushBullets();
  return blocks;
}

// ---------------------------------------------------------------------------
// Markdown table parsing (used by TableRenderer)
// ---------------------------------------------------------------------------

export interface ParsedTable {
  preText: string;
  headers: string[];
  rows: string[][];
  postText: string;
}

/**
 * Parse a markdown pipe-table from content.
 * Returns null when no table is detected.
 */
export function parseMarkdownTable(content: string): ParsedTable | null {
  const lines = content.split("\n");
  const tableLines: string[] = [];
  const preParts: string[] = [];
  const postParts: string[] = [];
  let inTable = false;
  let tableDone = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Skip separator rows: |---|---|
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        inTable = true;
        continue;
      }
      inTable = true;
      tableLines.push(trimmed);
    } else {
      if (inTable) tableDone = true;
      if (tableDone) {
        if (trimmed) postParts.push(trimmed);
      } else {
        if (trimmed) preParts.push(trimmed);
      }
    }
  }

  if (tableLines.length === 0) return null;

  const [headerRow, ...dataRows] = tableLines.map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim())
  );

  return {
    preText: preParts.join(" "),
    headers: headerRow ?? [],
    rows: dataRows,
    postText: postParts.join(" "),
  };
}

// ---------------------------------------------------------------------------
// Plain-text → HTML conversion (used when loading content into TipTap editor)
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe use as an HTML attribute value.
 * Prevents XSS via attribute injection (e.g. in alt or src attributes).
 */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert inline Markdown syntax to HTML.
 * Handles: **bold**, *italic*, `code`, [links](url), ![images](url), ~~strikethrough~~
 *
 * IMPORTANT: This preserves formatting when loading Markdown content into TipTap.
 * Without this, **bold** would display literally instead of as <strong>bold</strong>.
 *
 * Order matters: Process in order of precedence to avoid conflicts.
 */
function convertInlineMarkdownToHtml(text: string): string {
  if (!text) return text;

  let result = text;

  // 0. Remove escaped backslashes (\\text\\ → text)
  result = result.replace(/\\\\([^\\]+)\\\\/g, '$1');
  result = result.replace(/\\\\/g, '');

  // 1. Code blocks first (highest priority - don't process markdown inside code)
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 2. Images (before links - images use ![alt](url) syntax)
  // Only match complete image markdown syntax
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    // Ensure URL is valid (not empty and looks like a URL or path)
    if (url && url.trim()) {
      return `<img src="${escapeHtmlAttr(url.trim())}" alt="${escapeHtmlAttr(alt || "")}" class="inline-md-image" />`;
    }
    return match; // Return original if invalid
  });

  // 3. Links (before bold/italic to avoid conflicts with brackets)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 4. Bold (before italic to handle *** correctly)
  result = result.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');

  // 5. Italic (after bold)
  result = result.replace(/\*([^*]+?)\*/g, '<em>$1</em>');

  // 6. Strikethrough
  result = result.replace(/~~([^~]+?)~~/g, '<s>$1</s>');

  return result;
}

/**
 * Convert AI-generated plain-text (markdown-style) content to HTML.
 * Used to pre-process content before loading into the rich text editor.
 * If the content is already HTML, it is returned unchanged.
 */
export function plainTextToHtml(content: string): string {
  if (!content.trim()) return "<p></p>";

  // Handle GENERATED_IMAGE:: prefix (architecture diagrams)
  if (isGeneratedImageContent(content)) {
    const urls = parseGeneratedImageUrls(content);
    const images = urls.map(url =>
      `<img src="${url}" alt="Generated diagram" style="max-width: 600px; height: auto; display: block; margin: 1rem 0; cursor: pointer;" />`
    ).join('');
    return images || "<p>Image not available</p>";
  }

  // If content is already HTML, return it unchanged
  // CRITICAL: Do NOT process markdown on HTML - it destroys the formatted content
  // The backend normalizes content to Markdown, so HTML here means it was
  // intentionally formatted (e.g., from TipTap editor or legacy content)
  if (isHtmlContent(content)) {
    return content;
  }

  const lines = content.split("\n");
  const parts: string[] = [];
  let tableLines: string[] = [];
  let bulletItems: string[] = [];
  let isOrdered = false;
  let inTable = false;

  function flushTable(): void {
    if (tableLines.length === 0) return;
    const parsed = parseMarkdownTable(tableLines.join("\n"));
    if (parsed) {
      // Convert Markdown syntax in table headers and cells
      const ths = parsed.headers.map((h) => `<th>${convertInlineMarkdownToHtml(h)}</th>`).join("");
      const trs = parsed.rows
        .map((row) => `<tr>${row.map((c) => `<td>${convertInlineMarkdownToHtml(c)}</td>`).join("")}</tr>`)
        .join("");
      parts.push(
        `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
      );
    }
    tableLines = [];
    inTable = false;
  }

  function flushBullets(): void {
    if (bulletItems.length === 0) return;
    const tag = isOrdered ? "ol" : "ul";
    // Convert Markdown syntax in list items
    const lis = bulletItems.map((item) => `<li>${convertInlineMarkdownToHtml(item)}</li>`).join("");
    parts.push(`<${tag}>${lis}</${tag}>`);
    bulletItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushTable();
      flushBullets();
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        inTable = true;
        continue;
      }
      flushBullets();
      inTable = true;
      tableLines.push(trimmed);
      continue;
    }

    if (inTable) flushTable();

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (bulletItems.length > 0 && isOrdered) flushBullets();
      isOrdered = false;
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (bulletItems.length > 0 && !isOrdered) flushBullets();
      isOrdered = true;
      bulletItems.push(numberedMatch[1]);
      continue;
    }

    flushBullets();

    // Check for Markdown headings (### Heading)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = convertInlineMarkdownToHtml(headingMatch[2]);
      parts.push(`<h${level}>${headingText}</h${level}>`);
      continue;
    }

    // Check for colon-based headings (legacy format)
    if (trimmed.endsWith(":") && trimmed.length <= 80 && !trimmed.includes(".")) {
      parts.push(`<h3>${convertInlineMarkdownToHtml(trimmed)}</h3>`);
      continue;
    }

    // Convert Markdown syntax to HTML instead of stripping it
    const htmlContent = convertInlineMarkdownToHtml(trimmed);
    parts.push(`<p>${htmlContent}</p>`);
  }

  flushTable();
  flushBullets();

  return parts.join("") || "<p></p>";
}
