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

/** Section keys that always render a Mermaid architecture diagram. */
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
 * Convert AI-generated plain-text (markdown-style) content to HTML.
 * Used to pre-process content before loading into the rich text editor.
 * If the content is already HTML, it is returned unchanged.
 */
export function plainTextToHtml(content: string): string {
  if (!content.trim()) return "<p></p>";
  if (isHtmlContent(content)) return content;

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
      const ths = parsed.headers.map((h) => `<th>${h}</th>`).join("");
      const trs = parsed.rows
        .map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`)
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
    const lis = bulletItems.map((item) => `<li>${item}</li>`).join("");
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

    if (trimmed.endsWith(":") && trimmed.length <= 80 && !trimmed.includes(".")) {
      parts.push(`<h3>${trimmed}</h3>`);
      continue;
    }

    const clean = trimmed.replace(/\*\*/g, "").replace(/\*/g, "");
    parts.push(`<p>${clean}</p>`);
  }

  flushTable();
  flushBullets();

  return parts.join("") || "<p></p>";
}
