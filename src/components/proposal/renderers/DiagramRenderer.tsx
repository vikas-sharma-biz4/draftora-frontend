"use client";

import { useEffect, useState } from "react";

import {
  isGeneratedImageContent,
  isHtmlContent,
  parseArchitectureDescription,
  parseContentBlocks,
  parseGeneratedImageUrls,
} from "@/utils/contentParser";
import AIMarkdownRenderer from "@/components/proposal/AIMarkdownRenderer";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

interface DiagramRendererProps {
  content: string;
  sectionKey: string;
}

/**
 * Renders diagram sections with two tiers:
 *
 * 1. GENERATED_IMAGE:: content — renders one or more AI-generated images
 *    (Eraser.io architecture PNG or OpenAI user-flow chunks) inline.
 *    Multi-image user-flow chunks are shown in sequence with part labels.
 *    Images are constrained with max-height + click-to-expand modal.
 *
 * 2. Text content — any plain-text / HTML below the diagram is rendered
 *    using the standard block parser.
 */
export default function DiagramRenderer({
  content,
  sectionKey,
}: DiagramRendererProps): JSX.Element {
  const hasGeneratedImage = isGeneratedImageContent(content);
  const imageUrls = hasGeneratedImage ? parseGeneratedImageUrls(content) : [];
  const archDescription = hasGeneratedImage ? parseArchitectureDescription(content) : null;
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    if (!expandedUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedUrl(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [expandedUrl]);

  return (
    <div className="proposal-section-content">
      {/* Tier 1: AI-generated image(s) from Eraser.io or OpenAI user-flow */}
      {hasGeneratedImage && imageUrls.length > 0 && (
        <div className="generated-diagram-container" style={{ marginBottom: 24 }}>
          {imageUrls.map((url, idx) => (
            <div key={idx} style={{ marginBottom: imageUrls.length > 1 ? 20 : 0 }}>
              {/* Scroll container for very tall images */}
              <div
                style={{
                  width: "100%",
                  maxHeight: 680,
                  overflowY: "auto",
                  overflowX: "hidden",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                  padding: "12px 8px 8px",
                  boxSizing: "border-box",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-start",
                }}
              >
                <img
                  src={url}
                  alt={`Diagram${imageUrls.length > 1 ? ` — Part ${idx + 1} of ${imageUrls.length}` : ""}`}
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    objectFit: "contain",
                    display: "block",
                    margin: "0 auto",
                    borderRadius: 4,
                  }}
                />
              </div>
              {/* Expand + caption row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                {imageUrls.length > 1 && (
                  <span style={{ fontSize: 12, color: "#888" }}>
                    Part {idx + 1} of {imageUrls.length}
                  </span>
                )}
                <button
                  onClick={() => setExpandedUrl(url)}
                  style={{
                    fontSize: 11,
                    color: "#3730a3",
                    background: "#eef2ff",
                    border: "1px solid #c7d2fe",
                    borderRadius: 6,
                    padding: "3px 10px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ⤢ Click to Expand
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Architecture description — rendered below the diagram when present */}
      {archDescription && (
        <div style={{ marginTop: 20 }}>
          <AIMarkdownRenderer content={archDescription} />
        </div>
      )}

      {/* Fullscreen modal */}
      {expandedUrl && (
        <div
          onClick={() => setExpandedUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <button
              onClick={() => setExpandedUrl(null)}
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#666",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ✕
            </button>
            <img
              src={expandedUrl}
              alt="Architecture Diagram — Fullscreen"
              style={{
                maxWidth: "100%",
                height: "auto",
                display: "block",
                marginTop: 8,
              }}
            />
          </div>
        </div>
      )}

      {/* Text content — skip rendering when content IS the image URL string */}
      {!hasGeneratedImage &&
        (() => {
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
