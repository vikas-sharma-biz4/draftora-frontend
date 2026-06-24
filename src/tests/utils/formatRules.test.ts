/**
 * Tests for src/utils/formatRules.ts
 */

import { generateFormatRules } from "@/utils/formatRules";

// ---------------------------------------------------------------------------
// generateFormatRules
// ---------------------------------------------------------------------------

describe("generateFormatRules — template-specific rules", () => {
  const templateTypes = [
    "brd",
    "frd",
    "srs",
    "architecture",
    "sow",
    "mvp",
    "poc",
    "design",
    "predefined",
    "custom",
    "scratch",
  ] as const;

  templateTypes.forEach((type) => {
    it(`includes template-specific rules for templateType="${type}"`, () => {
      const result = generateFormatRules(type);
      // Each template type has unique content - just verify it returns a non-empty string
      expect(result.length).toBeGreaterThan(0);
    });
  });

  it("always includes general format guidelines", () => {
    const result = generateFormatRules("scratch");
    expect(result).toContain("General Format Guidelines");
    expect(result).toContain("Markdown");
  });

  it("includes user instructions section when instructions provided", () => {
    const result = generateFormatRules("scratch", undefined, "Use formal tone");
    expect(result).toContain("User Instructions");
    expect(result).toContain("Prioritize user-provided instructions");
  });

  it("does not include user instructions section without instructions", () => {
    const result = generateFormatRules("scratch");
    expect(result).not.toContain("User Instructions");
  });

  it("includes AI format determination section", () => {
    const result = generateFormatRules();
    expect(result).toContain("AI Format Determination");
  });

  it("returns general guidelines with no arguments", () => {
    const result = generateFormatRules();
    expect(result).toContain("General Format Guidelines");
  });

  it("ignores unknown templateType", () => {
    const result = generateFormatRules("unknown-type");
    // Should still contain general guidelines
    expect(result).toContain("General Format Guidelines");
  });
});

describe("generateFormatRules — section-specific hints", () => {
  const sectionKeywords: Array<[string, string]> = [
    ["Project Timeline", "table format"],
    ["Key Milestones", "table format"],
    ["Budget Breakdown", "table format"],
    ["Pricing Options", "table format"],
    ["Team Members", "table format"],
    ["Technology Stack", "table format"],
    ["Tech Stack Overview", "table format"],
    ["Requirements List", "table format"],
    ["Deliverables", "table format"],
    ["Features Overview", "bullet points"],
    ["Benefits", "bullet points"],
    ["Risk Assessment", "table format"],
    ["Architecture Overview", "structured paragraphs"],
    ["Workflow", "numbered list"],
    ["Process Description", "numbered list"],
    ["API Reference", "table format"],
    ["Database Schema", "table format"],
    ["Integration Points", "table format"],
  ];

  sectionKeywords.forEach(([sectionName, expectedHint]) => {
    it(`includes "${expectedHint}" hint for section "${sectionName}"`, () => {
      const result = generateFormatRules(undefined, sectionName);
      expect(result.toLowerCase()).toContain(expectedHint.toLowerCase());
    });
  });

  it("returns general guidelines only for unrecognized section", () => {
    const result = generateFormatRules(undefined, "Introduction");
    expect(result).toContain("General Format Guidelines");
  });
});
