/**
 * Tests for src/utils/formatters.ts
 */

import { formatFileSize, formatRelativeTime, formatInitials, formatSlug } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024 * 3.5)).toBe("3.5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1024 * 1024 * 1024 * 2)).toBe("2.0 GB");
  });

  it("formats exactly 1023 bytes as B", () => {
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats exactly 1024 bytes as KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent dates (<60s)", () => {
    const d = new Date(Date.now() - 10_000);
    expect(formatRelativeTime(d)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const d = new Date(Date.now() - 5 * 60_000);
    expect(formatRelativeTime(d)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const d = new Date(Date.now() - 3 * 3600_000);
    expect(formatRelativeTime(d)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const d = new Date(Date.now() - 2 * 86400_000);
    expect(formatRelativeTime(d)).toBe("2d ago");
  });

  it("returns formatted date for dates >= 7 days old", () => {
    const d = new Date(Date.now() - 10 * 86400_000);
    const result = formatRelativeTime(d);
    // Should be a full date string, not relative
    expect(result).not.toMatch(/ago|just now/);
  });

  it("accepts string dates", () => {
    const str = new Date(Date.now() - 30_000).toISOString();
    expect(formatRelativeTime(str)).toBe("just now");
  });
});

// ---------------------------------------------------------------------------
// formatInitials
// ---------------------------------------------------------------------------

describe("formatInitials", () => {
  it("returns initials for two words", () => {
    expect(formatInitials("John Doe")).toBe("JD");
  });

  it("returns single initial for one word", () => {
    expect(formatInitials("Alice")).toBe("A");
  });

  it("returns at most two characters", () => {
    expect(formatInitials("Alice Bob Carol")).toBe("AB");
  });

  it("handles extra whitespace", () => {
    expect(formatInitials("  Jane  Smith  ")).toBe("JS");
  });

  it("uppercases initials", () => {
    expect(formatInitials("john doe")).toBe("JD");
  });

  it("returns empty string when input is empty (w[0]?.toUpperCase() ?? '' branch)", () => {
    expect(formatInitials("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(formatInitials("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// formatSlug
// ---------------------------------------------------------------------------

describe("formatSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(formatSlug("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(formatSlug("Hello, World!")).toBe("hello-world");
  });

  it("collapses multiple hyphens", () => {
    expect(formatSlug("hello--world")).toBe("hello-world");
  });

  it("trims leading/trailing whitespace", () => {
    expect(formatSlug("  hello world  ")).toBe("hello-world");
  });

  it("handles already-slugged strings", () => {
    expect(formatSlug("hello-world")).toBe("hello-world");
  });
});
