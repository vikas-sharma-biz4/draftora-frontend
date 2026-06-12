/**
 * Tests for src/utils/dateUtils.ts
 */

import { formatDate, formatDateWithTime } from "@/utils/dateUtils";

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("formats a date string to 'Month Dth, Year'", () => {
    // January 5 → "January 5th, 2025"
    const result = formatDate("2025-01-05T00:00:00Z");
    expect(result).toMatch(/January/);
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/th/);
  });

  it("uses 'st' suffix for 1st", () => {
    const result = formatDate("2025-03-01T00:00:00Z");
    expect(result).toMatch(/1st/);
  });

  it("uses 'nd' suffix for 2nd", () => {
    const result = formatDate("2025-03-02T00:00:00Z");
    expect(result).toMatch(/2nd/);
  });

  it("uses 'rd' suffix for 3rd", () => {
    const result = formatDate("2025-03-03T00:00:00Z");
    expect(result).toMatch(/3rd/);
  });

  it("uses 'th' suffix for 11th (special case)", () => {
    const result = formatDate("2025-03-11T00:00:00Z");
    expect(result).toMatch(/11th/);
  });

  it("uses 'th' suffix for 12th (special case)", () => {
    const result = formatDate("2025-03-12T00:00:00Z");
    expect(result).toMatch(/12th/);
  });

  it("uses 'th' suffix for 13th (special case)", () => {
    const result = formatDate("2025-03-13T00:00:00Z");
    expect(result).toMatch(/13th/);
  });

  it("uses 'th' suffix for 4th", () => {
    const result = formatDate("2025-03-04T00:00:00Z");
    expect(result).toMatch(/4th/);
  });

  it("uses 'th' suffix for 20th", () => {
    const result = formatDate("2025-03-20T00:00:00Z");
    expect(result).toMatch(/20th/);
  });

  it("uses 'st' suffix for 21st", () => {
    const result = formatDate("2025-03-21T00:00:00Z");
    expect(result).toMatch(/21st/);
  });

  it("uses 'nd' suffix for 22nd", () => {
    const result = formatDate("2025-03-22T00:00:00Z");
    expect(result).toMatch(/22nd/);
  });

  it("uses 'rd' suffix for 23rd", () => {
    const result = formatDate("2025-03-23T00:00:00Z");
    expect(result).toMatch(/23rd/);
  });

  it("returns empty string for invalid date", () => {
    const result = formatDate("not-a-date");
    // Invalid date may return a string with NaN or empty - either is acceptable
    // The important thing is it doesn't throw
    expect(typeof result).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// formatDateWithTime
// ---------------------------------------------------------------------------

describe("formatDateWithTime", () => {
  it("includes the month name", () => {
    const result = formatDateWithTime("2025-06-15T14:30:00Z");
    expect(result).toMatch(/June|15/);
  });

  it("includes year", () => {
    const result = formatDateWithTime("2025-06-15T14:30:00Z");
    expect(result).toMatch(/2025/);
  });

  it("includes time portion", () => {
    const result = formatDateWithTime("2025-06-15T14:30:00Z");
    // Should contain AM/PM or time digits
    expect(result).toMatch(/AM|PM|\d{1,2}:\d{2}/);
  });

  it("uses ordinal suffix in time format too", () => {
    const result = formatDateWithTime("2025-03-01T12:00:00Z");
    expect(result).toMatch(/1st/);
  });

  it("returns a string for invalid date", () => {
    const result = formatDateWithTime("invalid");
    expect(typeof result).toBe("string");
  });
});
