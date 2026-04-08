"use client";

import { useEffect, useRef } from "react";

import {
  isGeneratedImageContent,
  isHtmlContent,
  parseContentBlocks,
  parseGeneratedImageUrls,
} from "@/utils/contentParser";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

interface DiagramRendererProps {
  content: string;
  /** Raw Mermaid diagram code (graph TD ...) — used as fallback only */
  mermaidCode?: string;
  sectionKey: string;
}

/**
 * Renders diagram sections with three tiers:
 *
 * 1. GENERATED_IMAGE:: content — renders one or more AI-generated images
 *    (Eraser.io architecture PNG or OpenAI user-flow chunks) inline.
 *    Multi-image user-flow chunks are shown in sequence with part labels.
 *
 * 2. Mermaid fallback — when no image URL is present but mermaidCode is
 *    provided, renders the Mermaid SVG client-side.
 *
 * 3. Text content — any plain-text / HTML below the diagram is rendered
 *    using the standard block parser.
 */
export default function DiagramRenderer({
  content,
  mermaidCode,
  sectionKey,
}: DiagramRendererProps): JSX.Element {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const hasGeneratedImage = isGeneratedImageContent(content);
  const imageUrls = hasGeneratedImage ? parseGeneratedImageUrls(content) : [];

  useEffect(() => {
    // Only render Mermaid when there is no generated image to show
    if (hasGeneratedImage || !mermaidCode || !mermaidRef.current) return;

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
  }, [hasGeneratedImage, mermaidCode, sectionKey]);

  return (
    <div className="proposal-section-content">
      {/* Tier 1: AI-generated image(s) from Eraser.io or OpenAI user-flow */}
      {hasGeneratedImage && imageUrls.length > 0 && (
        <div className="generated-diagram-container" style={{ marginBottom: 24 }}>
          {imageUrls.map((url, idx) => (
            <div key={idx} style={{ marginBottom: imageUrls.length > 1 ? 16 : 0 }}>
              <img
                src={url}
                alt={`Diagram${imageUrls.length > 1 ? ` — Part ${idx + 1} of ${imageUrls.length}` : ""}`}
                style={{ maxWidth: "100%", display: "block", margin: "0 auto" }}
              />
              {imageUrls.length > 1 && (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: 12,
                    color: "#888",
                    marginTop: 4,
                  }}
                >
                  Part {idx + 1} of {imageUrls.length}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tier 2: Mermaid fallback — only when no generated image is present */}
      {!hasGeneratedImage && mermaidCode && (
        <div className="mermaid-container" style={{ marginBottom: 24 }}>
          <span className="mermaid-label">Architecture Diagram</span>
          <div ref={mermaidRef} />
        </div>
      )}

      {/* Tier 3: Text content — skip rendering when content IS the image URL string */}
      {!hasGeneratedImage && (() => {
        const htmlContent = isHtmlContent(content);
        const blocks = htmlContent ? null : parseContentBlocks(content);
        return htmlContent ? (
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
        );
      })()}
    </div>
  );
}
