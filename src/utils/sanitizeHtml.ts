/**
 * Sanitizes an HTML string using DOMPurify to prevent XSS attacks.
 *
 * Use this wrapper whenever rendering user-supplied or AI-generated HTML
 * with dangerouslySetInnerHTML. DOMPurify strips all unsafe tags and
 * attributes (e.g. <script>, onerror=, javascript: hrefs) while keeping
 * safe structural and formatting tags intact.
 *
 * SSR-safe: returns the raw string unchanged when running in a Node.js
 * environment (no DOM available), since server-rendered HTML is never
 * injected into the live DOM without a client-side hydration pass.
 */

import DOMPurify from "dompurify";

/** Allowed HTML tags for proposal/rich-text content. */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
  "span",
  "hr",
];

/**
 * Allowed HTML attributes (safe subset only).
 *
 * Intentionally excludes:
 *   - "style"  → CSS injection / phishing via position:fixed overlays
 *   - "target" → handled separately via the afterSanitizeAttributes hook
 *                 which forces rel="noopener noreferrer" on all <a> tags
 */
const ALLOWED_ATTR = [
  "href",
  "src",
  "alt",
  "title",
  "class",
  "id",
  "rel",
  "width",
  "height",
  "colspan",
  "rowspan",
];

/**
 * Returns true when running in a server (Node.js) environment with no DOM.
 * Exported to allow test mocking of the SSR guard branch.
 *
 * @internal
 */
export function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

/**
 * Register DOMPurify hook at module level (runs once).
 * Forces rel="noopener noreferrer" on every <a> to prevent tab-napping
 * and information leakage via the Referer header.
 */
if (!isServerEnvironment()) {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("rel", "noopener noreferrer");
      node.setAttribute("target", "_blank");
    }
  });
}

/**
 * Returns a sanitized version of the given HTML string.
 *
 * @param html - Raw HTML string to sanitize.
 * @returns Sanitized HTML string safe for injection into the DOM.
 */
export function sanitizeHtml(html: string): string {
  if (isServerEnvironment()) {
    return html;
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
    FORCE_BODY: false,
  });
}
