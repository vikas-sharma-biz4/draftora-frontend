"use client";

import { detectContentType } from "@/utils/contentParser";
import BulletRenderer from "./renderers/BulletRenderer";
import DiagramRenderer from "./renderers/DiagramRenderer";
import ParagraphRenderer from "./renderers/ParagraphRenderer";
import TableRenderer from "./renderers/TableRenderer";

interface ContentRendererProps {
  sectionKey: string;
  content: string;
  /** Raw Mermaid diagram code — passed only for diagram sections. */
  mermaidCode?: string;
}

/**
 * Detects the content type for a proposal section and dispatches to the
 * correct renderer component:
 *
 *   table   → TableRenderer    (markdown pipe tables)
 *   bullets → BulletRenderer   (- / * / 1. lists)
 *   diagram → DiagramRenderer  (Mermaid architecture diagram + text)
 *   default → ParagraphRenderer (plain paragraphs with sub-headings)
 */
export default function ContentRenderer({
  sectionKey,
  content,
  mermaidCode,
}: ContentRendererProps): JSX.Element {
  const type = detectContentType(sectionKey, content);

  switch (type) {
    case "table":
      return <TableRenderer content={content} />;

    case "bullets":
      return <BulletRenderer content={content} />;

    case "diagram":
      return (
        <DiagramRenderer
          content={content}
          mermaidCode={mermaidCode}
          sectionKey={sectionKey}
        />
      );

    default:
      return <ParagraphRenderer content={content} />;
  }
}
