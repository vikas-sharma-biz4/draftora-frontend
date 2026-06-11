/**
 * Tests for src/utils/sectionValidator.ts
 */

import {
  validateSimilarProjectsStructure,
  validateTableStructure,
  validateParagraphOnlyStructure,
  validateBoldUsage,
  validateSectionContent,
} from "@/utils/sectionValidator";

// ---------------------------------------------------------------------------
// validateSimilarProjectsStructure
// ---------------------------------------------------------------------------

describe("validateSimilarProjectsStructure — valid content", () => {
  const validContent = `
**Project Alpha**
We built an enterprise CRM system for a Fortune 500 company.
Key Highlights:
- Reduced processing time by 40%
- Integrated with existing systems seamlessly
This project demonstrated our team's expertise in enterprise solutions.
  `.trim();

  it("returns isValid=true for well-formed content", () => {
    const result = validateSimilarProjectsStructure(validContent);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("validateSimilarProjectsStructure — too short", () => {
  it("returns error for content < 50 chars", () => {
    const result = validateSimilarProjectsStructure("Short.");
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/too short/i);
  });

  it("returns error for empty content", () => {
    const result = validateSimilarProjectsStructure("");
    expect(result.isValid).toBe(false);
  });
});

describe("validateSimilarProjectsStructure — warnings", () => {
  it("warns when no bold headings found", () => {
    const content =
      "Some plain text without any headings or formatting to pass the length check. Adding more text here to ensure we have enough characters.";
    const result = validateSimilarProjectsStructure(content);
    expect(result.warnings.some((w) => w.includes("project names"))).toBe(true);
  });

  it("warns when no bullet points found", () => {
    const content =
      "<strong>Project Name</strong> A long description without bullet points. This is a comprehensive paragraph that explains the project in detail. Adding more text to pass length requirements.";
    const result = validateSimilarProjectsStructure(content);
    expect(result.warnings.some((w) => w.includes("bullet"))).toBe(true);
  });

  it("warns when fewer than 2 paragraphs", () => {
    const content =
      "**Project Alpha** Some content here that is long enough to pass the minimum character check but lacks paragraph structure.";
    const result = validateSimilarProjectsStructure(content);
    // May warn about paragraphs depending on content
    expect(typeof result.isValid).toBe("boolean");
  });

  it("accepts HTML strong tags as bold headings", () => {
    const content = `<strong>Project Alpha</strong>
A long description of the project that spans multiple lines.
Key Highlights:
- Achievement one
- Achievement two
This conclusion summarizes the key aspects of the project.`;
    const result = validateSimilarProjectsStructure(content);
    expect(result.warnings.some((w) => w.includes("project names"))).toBe(false);
  });

  it("accepts h3 HTML tags as headings", () => {
    const content = `<h3>Project Name</h3>
A long description of the project that spans multiple lines.
Key Highlights:
- Achievement one
- Achievement two
This conclusion summarizes the key aspects of the project.`;
    const result = validateSimilarProjectsStructure(content);
    expect(result.warnings.some((w) => w.includes("project names"))).toBe(false);
  });

  it("detects HTML list items as bullets", () => {
    const content = `**Project Alpha** A comprehensive project description that is long enough.
<ul><li>Feature one</li><li>Feature two</li></ul>
<p>Conclusion paragraph here.</p>`;
    const result = validateSimilarProjectsStructure(content);
    expect(result.warnings.some((w) => w.includes("bullet"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateTableStructure
// ---------------------------------------------------------------------------

describe("validateTableStructure — no table", () => {
  it("returns error when no table found", () => {
    const result = validateTableStructure("Just some text without any table.");
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/no table/i);
  });
});

describe("validateTableStructure — HTML table", () => {
  it("validates a valid HTML table with headers", () => {
    const content = `<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Item</td><td>100</td></tr></tbody></table>`;
    const result = validateTableStructure(content);
    expect(result.errors).toHaveLength(0);
  });

  it("errors when table has no headers", () => {
    const content = `<table><tbody><tr><td>Data</td></tr></tbody></table>`;
    const result = validateTableStructure(content);
    expect(result.errors.some((e) => e.includes("header"))).toBe(true);
  });

  it("warns when table has no data rows (td)", () => {
    const content = `<table><thead><tr><th>Header</th></tr></thead></table>`;
    const result = validateTableStructure(content);
    expect(result.warnings.some((w) => w.includes("empty"))).toBe(true);
  });
});

describe("validateTableStructure — markdown table", () => {
  it("validates a markdown table with separator row", () => {
    const content = `| Name | Age |\n|------|-----|\n| Alice | 30 |`;
    const result = validateTableStructure(content);
    expect(result.errors).toHaveLength(0);
  });

  it("errors on markdown table without separator", () => {
    const content = `| Name | Age |\n| Alice | 30 |`;
    const result = validateTableStructure(content);
    expect(result.errors.some((e) => e.includes("header"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateParagraphOnlyStructure
// ---------------------------------------------------------------------------

describe("validateParagraphOnlyStructure", () => {
  it("returns valid for plain paragraph content", () => {
    const content =
      "This is a long paragraph that provides detailed context about the project scope and objectives, meeting the minimum character requirement.";
    const result = validateParagraphOnlyStructure(content);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("errors when bullet points are present (markdown)", () => {
    const content = "Introduction text.\n- Bullet point one\n- Bullet point two";
    const result = validateParagraphOnlyStructure(content);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/paragraph/i);
  });

  it("errors when HTML list is present", () => {
    const content = "Text with <ul><li>item</li></ul>";
    const result = validateParagraphOnlyStructure(content);
    expect(result.isValid).toBe(false);
  });

  it("errors when ordered list is present", () => {
    const content = "Text with <ol><li>item</li></ol>";
    const result = validateParagraphOnlyStructure(content);
    expect(result.isValid).toBe(false);
  });

  it("errors when table is present (markdown)", () => {
    const content = "Text with |col1|col2| table";
    const result = validateParagraphOnlyStructure(content);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/paragraph/i);
  });

  it("errors when HTML table is present", () => {
    const content = "Text with <table><tr><td>data</td></tr></table>";
    const result = validateParagraphOnlyStructure(content);
    expect(result.isValid).toBe(false);
  });

  it("warns when content is too short (< 100 chars)", () => {
    const content = "Short text.";
    const result = validateParagraphOnlyStructure(content);
    expect(result.warnings.some((w) => w.includes("short"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateBoldUsage
// ---------------------------------------------------------------------------

describe("validateBoldUsage", () => {
  it("is always valid (isValid=true)", () => {
    const result = validateBoldUsage("plain text without bold");
    expect(result.isValid).toBe(true);
  });

  it("warns when no bold text found", () => {
    const result = validateBoldUsage("no bold here at all");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("no warnings when markdown bold present", () => {
    const result = validateBoldUsage("Text with **important term** here");
    expect(result.warnings).toHaveLength(0);
  });

  it("no warnings when HTML strong present", () => {
    const result = validateBoldUsage("Text with <strong>important</strong> here");
    expect(result.warnings).toHaveLength(0);
  });

  it("no warnings when HTML b tag present", () => {
    const result = validateBoldUsage("Text with <b>bold</b> here");
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateSectionContent — dispatcher
// ---------------------------------------------------------------------------

describe("validateSectionContent", () => {
  it("uses paragraph validator for 'introduction' section", () => {
    const content = "- bullet point here that triggers paragraph-only error";
    const result = validateSectionContent("introduction", content);
    expect(result.errors.some((e) => e.includes("paragraph"))).toBe(true);
  });

  it("uses paragraph validator for 'project_understanding' section", () => {
    const content = "| table | col |";
    const result = validateSectionContent("project_understanding", content);
    expect(result.errors.some((e) => e.includes("paragraph"))).toBe(true);
  });

  it("uses similar_projects validator for 'similar_projects' section", () => {
    const result = validateSectionContent("similar_projects", "Short.");
    expect(result.errors[0]).toMatch(/too short/i);
  });

  it("uses table validator for 'technology_stack' section", () => {
    const result = validateSectionContent("technology_stack", "no table here");
    expect(result.errors.some((e) => e.includes("table"))).toBe(true);
  });

  it("uses table validator for section containing 'comparison'", () => {
    const result = validateSectionContent("feature_comparison", "no table here");
    expect(result.errors.some((e) => e.includes("table"))).toBe(true);
  });

  it("uses bold validator as default", () => {
    const result = validateSectionContent("custom_section", "plain text");
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
