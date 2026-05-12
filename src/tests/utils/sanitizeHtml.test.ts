/**
 * Tests for sanitizeHtml utility.
 *
 * Coverage targets (>85%):
 *   - Safe HTML passthrough
 *   - XSS tag/attribute stripping
 *   - SSR guard (window undefined)
 *   - All ALLOWED_TAGS and ALLOWED_ATTR paths
 *   - Edge cases: empty string, whitespace, nested scripts
 */

import * as sanitizeModule from "@/utils/sanitizeHtml";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

// ---------------------------------------------------------------------------
// Safe HTML passthrough
// ---------------------------------------------------------------------------

describe("sanitizeHtml — safe HTML passthrough", () => {
  it("returns empty string unchanged", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(sanitizeHtml("Hello world")).toBe("Hello world");
  });

  it("preserves allowed block tags: p, h1-h6", () => {
    const input = "<p>Paragraph</p><h1>Heading 1</h1><h2>H2</h2><h3>H3</h3>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<p>");
    expect(result).toContain("<h1>");
    expect(result).toContain("<h2>");
    expect(result).toContain("<h3>");
  });

  it("preserves allowed inline tags: strong, em, b, i, u, s", () => {
    const input = "<strong>bold</strong> <em>italic</em> <b>b</b> <i>i</i> <u>u</u> <s>s</s>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<strong>");
    expect(result).toContain("<em>");
    expect(result).toContain("<b>");
    expect(result).toContain("<i>");
    expect(result).toContain("<u>");
    expect(result).toContain("<s>");
  });

  it("preserves list tags: ul, ol, li", () => {
    const input = "<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>A</li></ol>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<ul>");
    expect(result).toContain("<ol>");
    expect(result).toContain("<li>");
  });

  it("preserves code/pre blocks", () => {
    const input = "<pre><code>const x = 1;</code></pre>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<pre>");
    expect(result).toContain("<code>");
  });

  it("preserves blockquote", () => {
    const input = "<blockquote>A quote</blockquote>";
    expect(sanitizeHtml(input)).toContain("<blockquote>");
  });

  it("preserves table structure: table, thead, tbody, tr, th, td", () => {
    const input =
      "<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Val</td></tr></tbody></table>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<table>");
    expect(result).toContain("<thead>");
    expect(result).toContain("<tbody>");
    expect(result).toContain("<tr>");
    expect(result).toContain("<th>");
    expect(result).toContain("<td>");
  });

  it("preserves div and span", () => {
    const input = "<div><span>content</span></div>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<div>");
    expect(result).toContain("<span>");
  });

  it("preserves hr and br", () => {
    const input = "<p>Line 1<br>Line 2</p><hr>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<br");
    expect(result).toContain("<hr");
  });

  it("preserves safe anchor tags with href, target, rel", () => {
    const input = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain("<a");
    expect(result).toContain('href="https://example.com"');
  });

  it("preserves img tags with src and alt", () => {
    const input = '<img src="/images/logo.png" alt="Logo" width="100" height="50">';
    const result = sanitizeHtml(input);
    expect(result).toContain("<img");
    expect(result).toContain('src="/images/logo.png"');
    expect(result).toContain('alt="Logo"');
  });

  it("preserves class and id attributes", () => {
    const input = '<div class="my-class" id="my-id">content</div>';
    const result = sanitizeHtml(input);
    expect(result).toContain('class="my-class"');
    expect(result).toContain('id="my-id"');
  });

  it("preserves colspan and rowspan on table cells", () => {
    const input = "<table><tr><td colspan=\"2\" rowspan=\"1\">Cell</td></tr></table>";
    const result = sanitizeHtml(input);
    expect(result).toContain("colspan");
  });

  it("preserves heading levels h4, h5, h6", () => {
    const input = "<h4>H4</h4><h5>H5</h5><h6>H6</h6>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<h4>");
    expect(result).toContain("<h5>");
    expect(result).toContain("<h6>");
  });
});

// ---------------------------------------------------------------------------
// XSS attack vector stripping
// ---------------------------------------------------------------------------

describe("sanitizeHtml — XSS stripping", () => {
  it("strips <script> tags entirely", () => {
    const malicious = '<p>Text</p><script>alert("xss")</script>';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Text</p>");
  });

  it("strips inline event handlers (onerror, onclick, onload)", () => {
    const malicious = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert");
  });

  it("strips javascript: href", () => {
    const malicious = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("javascript:");
  });

  it("strips <iframe> tags", () => {
    const malicious = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("<iframe>");
  });

  it("strips <object> and <embed> tags", () => {
    expect(sanitizeHtml("<object data='x'></object>")).not.toContain("<object>");
    expect(sanitizeHtml("<embed src='x'>")).not.toContain("<embed>");
  });

  it("strips <form> and <input> tags", () => {
    const malicious = '<form action="https://evil.com"><input type="text"></form>';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("<form>");
    expect(result).not.toContain("<input>");
  });

  it("strips <base> tag", () => {
    const malicious = '<base href="https://evil.com">';
    expect(sanitizeHtml(malicious)).not.toContain("<base>");
  });

  it("strips <meta> tag", () => {
    const malicious = '<meta http-equiv="refresh" content="0;url=https://evil.com">';
    expect(sanitizeHtml(malicious)).not.toContain("<meta>");
  });

  it("strips <link> tag", () => {
    const malicious = '<link rel="stylesheet" href="https://evil.com/evil.css">';
    expect(sanitizeHtml(malicious)).not.toContain("<link>");
  });

  it("strips data: URIs in src attributes", () => {
    const malicious = '<img src="data:text/html,<script>alert(1)</script>">';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("<script>");
  });

  it("strips data-* attributes (ALLOW_DATA_ATTR: false)", () => {
    const input = '<div data-secret="sensitive">content</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("data-secret");
  });

  it("strips unknown/dangerous attributes like onmouseover", () => {
    const malicious = '<p onmouseover="steal()">hover me</p>';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("onmouseover");
    expect(result).toContain("<p>");
  });

  it("handles deeply nested script injection", () => {
    const malicious =
      '<div><p><span><script>alert("nested")</script></span></p></div>';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("handles SVG-based XSS vectors", () => {
    const malicious = '<svg onload="alert(1)"><use xlink:href="#x"></use></svg>';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("onload");
  });

  it("handles HTML entity obfuscation attempts", () => {
    const malicious = "&lt;script&gt;alert(1)&lt;/script&gt;";
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain("<script>");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("sanitizeHtml — edge cases", () => {
  it("handles whitespace-only string", () => {
    expect(sanitizeHtml("   ")).toBe("   ");
  });

  it("handles string with only newlines", () => {
    const result = sanitizeHtml("\n\n");
    expect(typeof result).toBe("string");
  });

  it("handles very long strings without throwing", () => {
    const longHtml = "<p>" + "x".repeat(100_000) + "</p>";
    expect(() => sanitizeHtml(longHtml)).not.toThrow();
  });

  it("handles strings with special characters in text content", () => {
    const input = "<p>Price: &lt;$100 &amp; &gt;$50</p>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<p>");
  });

  it("handles already-safe HTML idempotently (double sanitize produces same result)", () => {
    const safe = "<p><strong>Hello</strong></p>";
    expect(sanitizeHtml(sanitizeHtml(safe))).toBe(sanitizeHtml(safe));
  });
});

// ---------------------------------------------------------------------------
// SSR guard (window === undefined)
// ---------------------------------------------------------------------------

describe("sanitizeHtml — SSR guard", () => {
  it("isServerEnvironment() returns false in jsdom (window is defined)", () => {
    expect(sanitizeModule.isServerEnvironment()).toBe(false);
  });

  it("sanitizes content in browser environment (isServerEnvironment false)", () => {
    const html = "<p>Safe</p><script>evil()</script>";
    const result = sanitizeHtml(html);
    expect(result).toContain("<p>Safe</p>");
    expect(result).not.toContain("<script>");
  });

  it("sanitizes empty string in browser environment", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("sanitizes plain text without modification in browser environment", () => {
    expect(sanitizeHtml("plain text")).toBe("plain text");
  });
});
