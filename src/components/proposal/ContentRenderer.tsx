"use client";

import { detectContentType, isGeneratedImageContent, isHtmlContent } from "@/utils/contentParser";
import BulletRenderer from "./renderers/BulletRenderer";
import DiagramRenderer from "./renderers/DiagramRenderer";
import ParagraphRenderer from "./renderers/ParagraphRenderer";
import TableRenderer from "./renderers/TableRenderer";
import AIMarkdownRenderer from "./AIMarkdownRenderer";

interface ContentRendererProps {
  sectionKey: string;
  content: string;
}

/**
 * Section keys classified as diagrams in contentParser but that actually
 * generate markdown table/text content — these must use AIMarkdownRenderer.
 * Overrides the DIAGRAM_SECTION_KEYS classification locally without touching
 * contentParser.ts.
 */
const AI_CONTENT_OVERRIDE_KEYS: string[] = ["proposed_technology_stack"];

/**
 * Section keys that should always use AIMarkdownRenderer even if they
 * contain HTML tags. This is needed for sections like similar_projects
 * that generate markdown with embedded HTML for image alignment.
 */
const FORCE_MARKDOWN_RENDERER_KEYS: string[] = ["similar_projects", "prototypes_developed"];

/**
 * Section keys that should ALWAYS use AIMarkdownRenderer regardless of content type.
 * This is a higher-priority list that bypasses all content detection logic.
 */
const ALWAYS_MARKDOWN_RENDERER_KEYS: string[] = ["similar_projects", "prototypes_developed"];

/**
 * Detects the content type for a proposal section and dispatches to the
 * correct renderer component:
 *
 *   HTML content              → existing renderers (unchanged, static sections)
 *   diagram (non-overridden)  → DiagramRenderer
 *   AI markdown               → AIMarkdownRenderer (non-HTML AI-generated content)
 *
 * Static sections that already contain HTML tags always take the legacy
 * rendering path. Only fresh AI-generated plain-text markdown goes through
 * AIMarkdownRenderer.
 */
export default function ContentRenderer({
  sectionKey,
  content,
}: ContentRendererProps): JSX.Element {
  const type = detectContentType(sectionKey, content);

  if (ALWAYS_MARKDOWN_RENDERER_KEYS.includes(sectionKey)) {
    return <AIMarkdownRenderer content={content} />;
  }

  // Sections with GENERATED_IMAGE:: content always use DiagramRenderer
  // regardless of section key — covers Eraser architecture + user-flow chunks.
  if (isGeneratedImageContent(content)) {
    return <DiagramRenderer content={content} sectionKey={sectionKey} />;
  }

  // Diagram sections use DiagramRenderer — EXCEPT keys overridden above
  // which produce markdown/table content despite their section key.
  if (type === "diagram" && !AI_CONTENT_OVERRIDE_KEYS.includes(sectionKey)) {
    return <DiagramRenderer content={content} sectionKey={sectionKey} />;
  }

  // Markdown pipe tables must always use AIMarkdownRenderer — even when cells
  // contain HTML tags like <br> that would otherwise trigger isHtmlContent().
  // TableRenderer's isHtmlContent() guard would send the raw Markdown string
  // through dangerouslySetInnerHTML, rendering | characters as plain text.
  // AIMarkdownRenderer + remark-gfm correctly parses pipe tables and handles
  // inline HTML (<br>) and Markdown bold (**text**) inside cells.
  if (type === "table" && content.trimStart().startsWith("|")) {
    return <AIMarkdownRenderer content={content} />;
  }

  // Static HTML content: use existing renderers unchanged.
  // EXCEPT: Force AIMarkdownRenderer for keys in FORCE_MARKDOWN_RENDERER_KEYS
  // (e.g., similar_projects generates markdown with embedded HTML for image alignment)
  if (isHtmlContent(content) && !FORCE_MARKDOWN_RENDERER_KEYS.includes(sectionKey)) {
    switch (type) {
      case "table":
        return <TableRenderer content={content} />;
      case "bullets":
        return <BulletRenderer content={content} />;
      default:
        return <ParagraphRenderer content={content} />;
    }
  }

  // AI-generated plain-text markdown: use ReactMarkdown renderer.
  return <AIMarkdownRenderer content={content} />;
}
