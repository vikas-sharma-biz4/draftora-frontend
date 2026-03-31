"use client";

import { isHtmlContent, parseContentBlocks } from "@/utils/contentParser";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

interface ParagraphRendererProps {
  content: string;
}

/**
 * Renders paragraph text with inline sub-heading detection.
 * Falls back to sanitised HTML rendering when content is already HTML.
 */
export default function ParagraphRenderer({
  content,
}: ParagraphRendererProps): JSX.Element {
  if (isHtmlContent(content)) {
    return (
      <div
        className="proposal-section-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    );
  }

  const blocks = parseContentBlocks(content);

  return (
    <div className="proposal-section-content">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h3 key={i} className="content-subheading">
              {block.text}
            </h3>
          );
        }
        if (block.kind === "bullets") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </Tag>
          );
        }
        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
}
