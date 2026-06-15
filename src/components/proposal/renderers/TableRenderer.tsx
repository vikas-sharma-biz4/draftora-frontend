"use client";

import { isHtmlContent, parseMarkdownTable } from "@/utils/contentParser";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

interface TableRendererProps {
  content: string;
}

/**
 * Parses a markdown-style pipe table and renders it as a styled HTML table.
 * Falls back to sanitised HTML rendering when content is already HTML.
 */
export default function TableRenderer({ content }: TableRendererProps): JSX.Element {
  if (isHtmlContent(content)) {
    return (
      <div
        className="proposal-section-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    );
  }

  const parsed = parseMarkdownTable(content);

  if (!parsed) {
    return (
      <div className="proposal-section-content">
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13 }}>{content}</pre>
      </div>
    );
  }

  const { preText, headers, rows, postText } = parsed;

  return (
    <div className="proposal-section-content">
      {preText && <p style={{ marginBottom: 16 }}>{preText}</p>}

      <div className="content-table-wrapper" style={{ margin: "16px 0" }}>
        <table className="content-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {postText && <p style={{ marginTop: 16 }}>{postText}</p>}
    </div>
  );
}
