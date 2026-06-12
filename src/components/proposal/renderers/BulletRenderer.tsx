"use client";

import { isHtmlContent, parseContentBlocks } from "@/utils/contentParser";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

interface BulletRendererProps {
  content: string;
}

/**
 * Renders bullet and numbered list content parsed from AI plain-text output.
 * Falls back to sanitised HTML rendering when content is already HTML.
 */
export default function BulletRenderer({ content }: BulletRendererProps): JSX.Element {
  if (isHtmlContent(content)) {
    return (
      <div
        className="proposal-section-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    );
  }

  const blocks = parseContentBlocks(content);

  let orderedCounter = 0;
  const renderedBlocks = blocks.map((block, i) => {
    if (block.kind === "heading") {
      return (
        <h3 key={i} className="content-subheading">
          {block.text}
        </h3>
      );
    }
    if (block.kind === "paragraph") {
      return <p key={i}>{block.text}</p>;
    }
    if (!block.ordered) {
      return (
        <ul key={i}>
          {block.items.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      );
    }
    const start = orderedCounter + 1;
    orderedCounter += block.items.length;
    return (
      <ol key={i} start={start}>
        {block.items.map((item, j) => (
          <li key={j}>{item}</li>
        ))}
      </ol>
    );
  });

  return <div className="proposal-section-content">{renderedBlocks}</div>;
}
