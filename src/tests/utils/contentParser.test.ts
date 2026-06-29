/**
 * Tests for src/utils/contentParser.ts
 *
 * Covers: isGeneratedImageContent, parseGeneratedImageUrls,
 * parseArchitectureDescription, detectContentType, isHtmlContent,
 * parseContentBlocks, parseMarkdownTable, plainTextToHtml
 */

import {
  IMAGE_SECTION_URL_PREFIX,
  ARCH_DESCRIPTION_SEPARATOR,
  DIAGRAM_SECTION_KEYS,
  isGeneratedImageContent,
  parseGeneratedImageUrls,
  parseArchitectureDescription,
  detectContentType,
  isHtmlContent,
  parseContentBlocks,
  parseMarkdownTable,
  plainTextToHtml,
} from "@/utils/contentParser";

// ---------------------------------------------------------------------------
// isGeneratedImageContent
// ---------------------------------------------------------------------------

describe("isGeneratedImageContent", () => {
  it("returns true when content starts with the prefix", () => {
    expect(isGeneratedImageContent(`${IMAGE_SECTION_URL_PREFIX}https://example.com/img.png`)).toBe(
      true
    );
  });

  it("returns false for regular text", () => {
    expect(isGeneratedImageContent("Hello World")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isGeneratedImageContent("")).toBe(false);
  });

  it("returns false when prefix is not at start", () => {
    expect(isGeneratedImageContent(`text${IMAGE_SECTION_URL_PREFIX}url`)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseGeneratedImageUrls
// ---------------------------------------------------------------------------

describe("parseGeneratedImageUrls", () => {
  it("returns empty array when content is not image content", () => {
    expect(parseGeneratedImageUrls("regular text")).toEqual([]);
  });

  it("returns single URL", () => {
    const url = "https://example.com/diagram.png";
    const result = parseGeneratedImageUrls(`${IMAGE_SECTION_URL_PREFIX}${url}`);
    expect(result).toEqual([url]);
  });

  it("returns multiple pipe-separated URLs", () => {
    const urls = ["https://a.com/1.png", "https://b.com/2.png"];
    const result = parseGeneratedImageUrls(`${IMAGE_SECTION_URL_PREFIX}${urls.join("|")}`);
    expect(result).toEqual(urls);
  });

  it("strips architecture description block", () => {
    const url = "https://eraser.io/arch.png";
    const content = `${IMAGE_SECTION_URL_PREFIX}${url}${ARCH_DESCRIPTION_SEPARATOR}This is a description`;
    const result = parseGeneratedImageUrls(content);
    expect(result).toEqual([url]);
    expect(result[0]).not.toContain("ARCH_DESCRIPTION");
  });

  it("trims whitespace from URLs", () => {
    const result = parseGeneratedImageUrls(
      `${IMAGE_SECTION_URL_PREFIX}  https://example.com/img.png  `
    );
    expect(result).toEqual(["https://example.com/img.png"]);
  });

  it("filters out empty strings from split", () => {
    const result = parseGeneratedImageUrls(
      `${IMAGE_SECTION_URL_PREFIX}https://a.com||https://b.com`
    );
    expect(result).toEqual(["https://a.com", "https://b.com"]);
  });
});

// ---------------------------------------------------------------------------
// parseArchitectureDescription
// ---------------------------------------------------------------------------

describe("parseArchitectureDescription", () => {
  it("returns null when no separator is present", () => {
    expect(parseArchitectureDescription("no separator here")).toBeNull();
  });

  it("returns description text after separator", () => {
    const content = `${IMAGE_SECTION_URL_PREFIX}https://eraser.io/arch.png${ARCH_DESCRIPTION_SEPARATOR}This is the architecture description`;
    expect(parseArchitectureDescription(content)).toBe("This is the architecture description");
  });

  it("returns null when description is empty after separator", () => {
    const content = `url${ARCH_DESCRIPTION_SEPARATOR}   `;
    expect(parseArchitectureDescription(content)).toBeNull();
  });

  it("trims whitespace from description", () => {
    const content = `url${ARCH_DESCRIPTION_SEPARATOR}  padded text  `;
    expect(parseArchitectureDescription(content)).toBe("padded text");
  });
});

// ---------------------------------------------------------------------------
// detectContentType
// ---------------------------------------------------------------------------

describe("detectContentType", () => {
  it("returns 'diagram' for diagram section keys", () => {
    for (const key of DIAGRAM_SECTION_KEYS) {
      expect(detectContentType(key, "any content")).toBe("diagram");
    }
  });

  it("returns 'table' when content has a markdown pipe table", () => {
    expect(detectContentType("custom_section", "| Col1 | Col2 |\n|------|------|\n| A | B |")).toBe(
      "table"
    );
  });

  it("returns 'bullets' for dash-prefixed list", () => {
    expect(detectContentType("section", "- Item one\n- Item two")).toBe("bullets");
  });

  it("returns 'bullets' for asterisk-prefixed list", () => {
    expect(detectContentType("section", "* Item one\n* Item two")).toBe("bullets");
  });

  it("returns 'bullets' for numbered list", () => {
    expect(detectContentType("section", "1. First\n2. Second")).toBe("bullets");
  });

  it("returns 'paragraph' for plain text", () => {
    expect(detectContentType("section", "This is a plain paragraph.")).toBe("paragraph");
  });
});

// ---------------------------------------------------------------------------
// isHtmlContent
// ---------------------------------------------------------------------------

describe("isHtmlContent", () => {
  it("returns true for content with HTML tags", () => {
    expect(isHtmlContent("<p>Hello</p>")).toBe(true);
  });

  it("returns true for inline HTML", () => {
    expect(isHtmlContent("text with <strong>bold</strong> content")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isHtmlContent("plain text without tags")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isHtmlContent("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseContentBlocks
// ---------------------------------------------------------------------------

describe("parseContentBlocks", () => {
  it("returns empty array for empty input", () => {
    expect(parseContentBlocks("")).toEqual([]);
  });

  it("returns a paragraph block for plain text", () => {
    const blocks = parseContentBlocks("Hello world");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ kind: "paragraph", text: "Hello world" });
  });

  it("strips markdown bold from paragraphs", () => {
    const blocks = parseContentBlocks("Text with **bold** and *italic* here");
    expect(blocks[0].kind).toBe("paragraph");
    if (blocks[0].kind === "paragraph") {
      expect(blocks[0].text).toBe("Text with bold and italic here");
    }
  });

  it("parses a sub-heading (line ending with colon)", () => {
    const blocks = parseContentBlocks("Key Highlights:");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ kind: "heading", text: "Key Highlights:" });
  });

  it("does not treat long colon-ending lines as headings (>80 chars)", () => {
    const longLine = "A".repeat(81) + ":";
    const blocks = parseContentBlocks(longLine);
    expect(blocks[0].kind).toBe("paragraph");
  });

  it("does not treat colon-ending lines with periods as headings", () => {
    const blocks = parseContentBlocks("This is a sentence. With a colon:");
    expect(blocks[0].kind).toBe("paragraph");
  });

  it("parses unordered bullet list", () => {
    const blocks = parseContentBlocks("- First item\n- Second item");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      kind: "bullets",
      items: ["First item", "Second item"],
      ordered: false,
    });
  });

  it("parses asterisk bullet list", () => {
    const blocks = parseContentBlocks("* Alpha\n* Beta");
    expect(blocks[0]).toEqual({
      kind: "bullets",
      items: ["Alpha", "Beta"],
      ordered: false,
    });
  });

  it("parses ordered (numbered) list", () => {
    const blocks = parseContentBlocks("1. First\n2. Second\n3. Third");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      kind: "bullets",
      items: ["First", "Second", "Third"],
      ordered: true,
    });
  });

  it("flushes unordered bullets on blank line", () => {
    const text = "- Item one\n- Item two\n\nParagraph after";
    const blocks = parseContentBlocks(text);
    expect(blocks[0]).toMatchObject({ kind: "bullets", ordered: false });
    expect(blocks[1]).toMatchObject({ kind: "paragraph" });
  });

  it("does NOT flush ordered list on blank line (stays in one block)", () => {
    const text = "1. First\n\n2. Second";
    const blocks = parseContentBlocks(text);
    const bulletBlocks = blocks.filter((b) => b.kind === "bullets");
    expect(bulletBlocks).toHaveLength(1);
    if (bulletBlocks[0].kind === "bullets") {
      expect(bulletBlocks[0].ordered).toBe(true);
      expect(bulletBlocks[0].items).toHaveLength(2);
    }
  });

  it("switches from ordered to unordered list by flushing previous", () => {
    const text = "1. Ordered\n- Unordered";
    const blocks = parseContentBlocks(text);
    const bulletBlocks = blocks.filter((b) => b.kind === "bullets");
    expect(bulletBlocks).toHaveLength(2);
    if (bulletBlocks[0].kind === "bullets" && bulletBlocks[1].kind === "bullets") {
      expect(bulletBlocks[0].ordered).toBe(true);
      expect(bulletBlocks[1].ordered).toBe(false);
    }
  });

  it("switches from unordered to ordered by flushing previous", () => {
    const text = "- Unordered\n1. Ordered";
    const blocks = parseContentBlocks(text);
    const bulletBlocks = blocks.filter((b) => b.kind === "bullets");
    expect(bulletBlocks).toHaveLength(2);
  });

  it("flushes pending bullets before paragraph", () => {
    const text = "- Item one\nParagraph text here";
    const blocks = parseContentBlocks(text);
    expect(blocks[0].kind).toBe("bullets");
    expect(blocks[1].kind).toBe("paragraph");
  });

  it("handles mixed content: heading, bullets, paragraph", () => {
    const text = [
      "Key Features:",
      "- Feature one",
      "- Feature two",
      "",
      "This is a summary paragraph.",
    ].join("\n");
    const blocks = parseContentBlocks(text);
    expect(blocks[0]).toMatchObject({ kind: "heading" });
    expect(blocks[1]).toMatchObject({ kind: "bullets" });
    expect(blocks[2]).toMatchObject({ kind: "paragraph" });
  });
});

// ---------------------------------------------------------------------------
// parseMarkdownTable
// ---------------------------------------------------------------------------

describe("parseMarkdownTable", () => {
  it("returns null when no table is present", () => {
    expect(parseMarkdownTable("No table here")).toBeNull();
  });

  it("parses a simple markdown table", () => {
    const content = "| Name | Age |\n|------|-----|\n| Alice | 30 |";
    const result = parseMarkdownTable(content);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(["Name", "Age"]);
    expect(result!.rows).toEqual([["Alice", "30"]]);
  });

  it("captures pre-table text", () => {
    const content = "Intro text\n| Col |\n|-----|\n| val |";
    const result = parseMarkdownTable(content);
    expect(result!.preText).toBe("Intro text");
  });

  it("captures post-table text", () => {
    const content = "| Col |\n|-----|\n| val |\nConclusion text";
    const result = parseMarkdownTable(content);
    expect(result!.postText).toBe("Conclusion text");
  });

  it("skips separator rows (|---|---|)", () => {
    const content = "| A | B |\n|---|---|\n| 1 | 2 |";
    const result = parseMarkdownTable(content);
    expect(result!.headers).toEqual(["A", "B"]);
    expect(result!.rows).toHaveLength(1);
  });

  it("returns empty preText and postText when there are none", () => {
    const content = "| Name | Value |\n|------|-------|\n| key | val |";
    const result = parseMarkdownTable(content);
    expect(result!.preText).toBe("");
    expect(result!.postText).toBe("");
  });

  it("parses multi-row table", () => {
    const content = "| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |";
    const result = parseMarkdownTable(content);
    expect(result!.rows).toHaveLength(2);
    expect(result!.rows[1]).toEqual(["Bob", "25"]);
  });
});

// ---------------------------------------------------------------------------
// plainTextToHtml
// ---------------------------------------------------------------------------

describe("plainTextToHtml — empty/whitespace", () => {
  it("returns <p></p> for empty string", () => {
    expect(plainTextToHtml("")).toBe("<p></p>");
  });

  it("returns <p></p> for whitespace-only string", () => {
    expect(plainTextToHtml("   \n\t  ")).toBe("<p></p>");
  });
});

describe("plainTextToHtml — GENERATED_IMAGE::", () => {
  it("wraps single image URL in an img tag", () => {
    const url = "https://eraser.io/diagram.png";
    const result = plainTextToHtml(`${IMAGE_SECTION_URL_PREFIX}${url}`);
    expect(result).toContain(`src="${url}"`);
    expect(result).toContain("<img");
  });

  it("wraps multiple pipe-separated URLs in multiple img tags", () => {
    const urls = ["https://a.com/1.png", "https://b.com/2.png"];
    const result = plainTextToHtml(`${IMAGE_SECTION_URL_PREFIX}${urls.join("|")}`);
    expect(result).toContain('src="https://a.com/1.png"');
    expect(result).toContain('src="https://b.com/2.png"');
  });

  it("returns <p>Image not available</p> when no valid URLs", () => {
    const result = plainTextToHtml(`${IMAGE_SECTION_URL_PREFIX}`);
    expect(result).toBe("<p>Image not available</p>");
  });
});

describe("plainTextToHtml — already-HTML content", () => {
  it("returns HTML content unchanged", () => {
    const html = "<p>Already <strong>formatted</strong></p>";
    expect(plainTextToHtml(html)).toBe(html);
  });
});

describe("plainTextToHtml — bullet lists", () => {
  it("converts dash-bullets to <ul><li>", () => {
    const result = plainTextToHtml("- Item one\n- Item two");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>Item one</li>");
    expect(result).toContain("<li>Item two</li>");
    expect(result).toContain("</ul>");
  });

  it("converts asterisk-bullets to <ul><li>", () => {
    const result = plainTextToHtml("* Alpha\n* Beta");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>Alpha</li>");
  });
});

describe("plainTextToHtml — ordered lists", () => {
  it("converts numbered list to <ol><li>", () => {
    const result = plainTextToHtml("1. First\n2. Second\n3. Third");
    expect(result).toContain("<ol>");
    expect(result).toContain("<li>First</li>");
    expect(result).toContain("<li>Second</li>");
    expect(result).toContain("</ol>");
  });

  it("keeps ordered list together across blank lines", () => {
    const result = plainTextToHtml("1. First\n\n2. Second");
    const olMatches = result.match(/<ol>/g);
    expect(olMatches).toHaveLength(1);
  });

  it("adds start attribute to subsequent ol blocks interrupted by sub-content", () => {
    const content = "1. Step One\n- bullet\n2. Step Two\n- bullet\n3. Step Three";
    const result = plainTextToHtml(content);
    expect(result).toContain("<ol>");
    expect(result).toContain('<ol start="2">');
    expect(result).toContain('<ol start="3">');
    expect(result).toContain("<li>Step One</li>");
    expect(result).toContain("<li>Step Two</li>");
    expect(result).toContain("<li>Step Three</li>");
  });

  it("resets start counter when a new sequence begins from 1", () => {
    const content =
      "1. First\n- bullet\n2. Second\n\nParagraph\n\n1. New One\n- bullet\n2. New Two";
    const result = plainTextToHtml(content);
    const startAttrs = [...result.matchAll(/ start="(\d+)"/g)].map((m) => parseInt(m[1], 10));
    expect(startAttrs).toContain(2);
    const olCount = (result.match(/<ol[^>]*>/g) ?? []).length;
    expect(olCount).toBe(4);
  });
});

describe("plainTextToHtml — markdown headings", () => {
  it("converts # heading to <h1>", () => {
    const result = plainTextToHtml("# Main Title");
    expect(result).toContain("<h1>Main Title</h1>");
  });

  it("converts ## heading to <h2>", () => {
    const result = plainTextToHtml("## Sub Heading");
    expect(result).toContain("<h2>Sub Heading</h2>");
  });

  it("converts ###### to <h6>", () => {
    const result = plainTextToHtml("###### Deep heading");
    expect(result).toContain("<h6>Deep heading</h6>");
  });
});

describe("plainTextToHtml — colon-style headings", () => {
  it("converts short colon-ending line to <h3>", () => {
    const result = plainTextToHtml("Key Highlights:");
    expect(result).toContain("<h3>Key Highlights:</h3>");
  });

  it("does not convert long colon-ending lines to headings", () => {
    const longLine = "A".repeat(81) + ":";
    const result = plainTextToHtml(longLine);
    expect(result).not.toContain("<h3>");
    expect(result).toContain("<p>");
  });
});

describe("plainTextToHtml — paragraphs", () => {
  it("wraps plain text in <p> tag", () => {
    const result = plainTextToHtml("This is a paragraph.");
    expect(result).toContain("<p>This is a paragraph.</p>");
  });
});

describe("plainTextToHtml — tables", () => {
  it("converts markdown table to HTML table", () => {
    const content = "| Name | Age |\n|------|-----|\n| Alice | 30 |";
    const result = plainTextToHtml(content);
    expect(result).toContain("<table>");
    expect(result).toContain("<th>Name</th>");
    expect(result).toContain("<td>Alice</td>");
    expect(result).toContain("</table>");
  });

  it("flushes table content at end of input", () => {
    const content = "| Col |\n|-----|\n| val |";
    const result = plainTextToHtml(content);
    expect(result).toContain("<table>");
  });
});

describe("plainTextToHtml — inline markdown", () => {
  it("converts **bold** to <strong>", () => {
    const result = plainTextToHtml("This is **important** text.");
    expect(result).toContain("<strong>important</strong>");
  });

  it("converts *italic* to <em>", () => {
    const result = plainTextToHtml("This is *italic* text.");
    expect(result).toContain("<em>italic</em>");
  });

  it("converts `code` to <code>", () => {
    const result = plainTextToHtml("Use `npm install` to install.");
    expect(result).toContain("<code>npm install</code>");
  });

  it("converts [link](url) to <a> tag", () => {
    const result = plainTextToHtml("See [our docs](https://docs.example.com) here.");
    expect(result).toContain('<a href="https://docs.example.com">our docs</a>');
  });

  it("converts ![img](url) to <img> tag", () => {
    const result = plainTextToHtml("See ![diagram](https://example.com/img.png) here.");
    expect(result).toContain('<img src="https://example.com/img.png"');
    expect(result).toContain('alt="diagram"');
  });

  it("does not produce an img tag when image URL is whitespace-only (if(url && url.trim()) false branch)", () => {
    // url=" " satisfies [^)]+ but url.trim() === "" → falsy → returns match unchanged.
    // The link regex then processes [alt]( ) further, but no <img> is ever created.
    const input = "See ![alt]( ) here.";
    const result = plainTextToHtml(input);
    expect(result).not.toContain("<img");
  });

  it("converts ~~strikethrough~~ to <s>", () => {
    const result = plainTextToHtml("This is ~~old~~ outdated.");
    expect(result).toContain("<s>old</s>");
  });

  it("applies inline markdown inside list items", () => {
    const result = plainTextToHtml("- **Bold item**\n- *Italic item*");
    expect(result).toContain("<strong>Bold item</strong>");
    expect(result).toContain("<em>Italic item</em>");
  });

  it("applies inline markdown inside table cells", () => {
    const result = plainTextToHtml(
      "| **Header** | Value |\n|------------|-------|\n| key | *val* |"
    );
    expect(result).toContain("<strong>Header</strong>");
    expect(result).toContain("<em>val</em>");
  });
});

describe("plainTextToHtml — list type switching", () => {
  it("creates separate ul and ol when switching from ordered to unordered", () => {
    const content = "1. Ordered item\n- Unordered item";
    const result = plainTextToHtml(content);
    expect(result).toContain("<ol>");
    expect(result).toContain("<ul>");
  });

  it("creates separate ol and ul when switching from unordered to ordered", () => {
    const content = "- Unordered\n1. Ordered";
    const result = plainTextToHtml(content);
    expect(result).toContain("<ul>");
    expect(result).toContain("<ol>");
  });

  it("flushes bullets when table starts", () => {
    const content = "- Bullet item\n| Col |\n|-----|\n| val |";
    const result = plainTextToHtml(content);
    expect(result).toContain("<ul>");
    expect(result).toContain("<table>");
  });
});

describe("plainTextToHtml — escapeHtmlAttr (via image inline)", () => {
  it("escapes & in image URLs", () => {
    const result = plainTextToHtml("See ![img](https://example.com/img?a=1&b=2) here.");
    expect(result).toContain("&amp;");
  });
});
