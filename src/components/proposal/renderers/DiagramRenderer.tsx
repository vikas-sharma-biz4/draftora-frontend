"use client";

import { useEffect, useRef } from "react";

import { isHtmlContent, parseContentBlocks } from "@/utils/contentParser";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

interface DiagramRendererProps {
  content: string;
  /** Raw Mermaid diagram code (graph TD ...) */
  mermaidCode?: string;
  sectionKey: string;
}

/**
 * Renders diagram sections: shows the Mermaid architecture diagram above
 * the section's text content.
 *
 * The Mermaid diagram is rendered client-side using mermaid.js.
 * If rendering fails the raw Mermaid code is shown in a <pre> block.
 */
export default function DiagramRenderer({
  content,
  mermaidCode,
  sectionKey,
}: DiagramRendererProps): JSX.Element {
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mermaidCode || !mermaidRef.current) return;

    let cancelled = false;

    import("mermaid")
      .then((mod) => {
        if (cancelled || !mermaidRef.current) return;
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });
        const id = `mermaid-${sectionKey}-${Date.now()}`;
        mermaid
          .render(id, mermaidCode)
          .then(({ svg }) => {
            if (!cancelled && mermaidRef.current) {
              mermaidRef.current.innerHTML = svg;
            }
          })
          .catch(() => {
            if (!cancelled && mermaidRef.current) {
              mermaidRef.current.innerHTML = `<pre style="font-size:12px;overflow-x:auto;white-space:pre-wrap">${mermaidCode}</pre>`;
            }
          });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [mermaidCode, sectionKey]);

  const htmlContent = isHtmlContent(content);
  const blocks = htmlContent ? null : parseContentBlocks(content);

  return (
    <div className="proposal-section-content">
      {mermaidCode && (
        <div className="mermaid-container" style={{ marginBottom: 24 }}>
          <span className="mermaid-label">Architecture Diagram</span>
          <div ref={mermaidRef} />
        </div>
      )}

      {htmlContent ? (
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
      ) : (
        blocks?.map((block, i) => {
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
        })
      )}
    </div>
  );
}
