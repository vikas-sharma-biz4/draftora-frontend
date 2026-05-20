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
 * Section keys that should always use AIMarkdownRenderer even if they
 * contain HTML tags. This is needed for sections like similar_projects
 * that generate markdown with embedded HTML for image alignment.
 */
const FORCE_MARKDOWN_RENDERER_KEYS: string[] = [
  "similar_projects",
  "prototypes_developed",
];

/**
 * Section keys that should ALWAYS use AIMarkdownRenderer regardless of content type.
 * This is a higher-priority list that bypasses all content detection logic.
 */
const ALWAYS_MARKDOWN_RENDERER_KEYS: string[] = [
  "similar_projects",
  "prototypes_developed",
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

  // Debug logging to verify section key routing
  console.log('=== ContentRenderer Debug ===');
  console.log('[ContentRenderer] sectionKey:', sectionKey);
  console.log('[ContentRenderer] type:', type);
  console.log('[ContentRenderer] isHtmlContent:', isHtmlContent(content));
  console.log('[ContentRenderer] isGeneratedImageContent:', isGeneratedImageContent(content));
  console.log('[ContentRenderer] ALWAYS_MARKDOWN_RENDERER_KEYS:', ALWAYS_MARKDOWN_RENDERER_KEYS);
  console.log('[ContentRenderer] ALWAYS_MARKDOWN_RENDERER_KEYS includes sectionKey:', ALWAYS_MARKDOWN_RENDERER_KEYS.includes(sectionKey));
  console.log('[ContentRenderer] FORCE_MARKDOWN_RENDERER_KEYS:', FORCE_MARKDOWN_RENDERER_KEYS);
  console.log('[ContentRenderer] FORCE_MARKDOWN_RENDERER_KEYS includes sectionKey:', FORCE_MARKDOWN_RENDERER_KEYS.includes(sectionKey));
  console.log('[ContentRenderer] AI_CONTENT_OVERRIDE_KEYS:', AI_CONTENT_OVERRIDE_KEYS);
  console.log('[ContentRenderer] AI_CONTENT_OVERRIDE_KEYS includes sectionKey:', AI_CONTENT_OVERRIDE_KEYS.includes(sectionKey));
  console.log('[ContentRenderer] content (first 200 chars):', content.substring(0, 200));
  console.log('=== End ContentRenderer Debug ===');

  // HIGH PRIORITY: Always use AIMarkdownRenderer for keys in ALWAYS_MARKDOWN_RENDERER_KEYS
  // This bypasses all content detection logic to ensure markdown is properly rendered
  if (ALWAYS_MARKDOWN_RENDERER_KEYS.includes(sectionKey)) {
    console.log('[ContentRenderer] Using AIMarkdownRenderer for section:', sectionKey);
    return <AIMarkdownRenderer content={content} />;
  }

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
