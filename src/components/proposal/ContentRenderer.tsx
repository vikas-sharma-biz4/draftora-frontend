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
const AI_CONTENT_OVERRIDE_KEYS: string[] = [
  "proposed_technology_stack",
];

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

  // Sections with GENERATED_IMAGE:: content always use DiagramRenderer
  // regardless of section key — covers Eraser architecture + user-flow chunks.
  if (isGeneratedImageContent(content)) {
    return (
      <DiagramRenderer
        content={content}
        sectionKey={sectionKey}
      />
    );
  }

  // Diagram sections use DiagramRenderer — EXCEPT keys overridden above
  // which produce markdown/table content despite their section key.
  if (type === "diagram" && !AI_CONTENT_OVERRIDE_KEYS.includes(sectionKey)) {
    return (
      <DiagramRenderer
        content={content}
        sectionKey={sectionKey}
      />
    );
  }

  // Static HTML content: use existing renderers unchanged.
  if (isHtmlContent(content)) {
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
