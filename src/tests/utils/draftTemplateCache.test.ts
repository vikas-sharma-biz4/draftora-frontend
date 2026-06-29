/**
 * Tests for src/utils/draftTemplateCache.ts
 *
 * Coverage targets:
 *   - readCache: empty localStorage → returns {}
 *   - readCache: valid JSON array → returns parsed object
 *   - readCache: invalid JSON → catch → returns {}
 *   - writeCache: localStorage.setItem throws → catch ignores
 *   - getDraftTemplateMeta: existing key → returns meta
 *   - getDraftTemplateMeta: missing key → returns null (?? null branch)
 *   - setDraftTemplateMeta: stores meta in localStorage
 *   - removeDraftTemplateMeta: removes entry from localStorage
 */

import {
  getDraftTemplateMeta,
  setDraftTemplateMeta,
  removeDraftTemplateMeta,
} from "@/utils/draftTemplateCache";

const CACHE_KEY = "draft_template_meta_v1";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// getDraftTemplateMeta
// ---------------------------------------------------------------------------

describe("getDraftTemplateMeta", () => {
  it("returns null when localStorage is empty (readCache returns {}, ?? null branch)", () => {
    expect(getDraftTemplateMeta("draft-1")).toBeNull();
  });

  it("returns null when key does not exist in cache", () => {
    setDraftTemplateMeta("other-draft", { templateId: "t1", templateType: "custom" });
    expect(getDraftTemplateMeta("missing-key")).toBeNull();
  });

  it("returns the stored meta when key exists", () => {
    const meta = { templateId: "template-abc", templateType: "custom" };
    setDraftTemplateMeta("draft-99", meta);
    expect(getDraftTemplateMeta("draft-99")).toEqual(meta);
  });

  it("returns null templateId when stored that way", () => {
    const meta = { templateId: null, templateType: "scratch" };
    setDraftTemplateMeta("draft-null", meta);
    expect(getDraftTemplateMeta("draft-null")).toEqual(meta);
  });
});

// ---------------------------------------------------------------------------
// setDraftTemplateMeta
// ---------------------------------------------------------------------------

describe("setDraftTemplateMeta", () => {
  it("persists meta to localStorage", () => {
    setDraftTemplateMeta("draft-10", { templateId: "t2", templateType: "scratch" });
    const raw = localStorage.getItem(CACHE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed["draft-10"]).toEqual({ templateId: "t2", templateType: "scratch" });
  });

  it("merges with existing cache entries", () => {
    setDraftTemplateMeta("draft-A", { templateId: "tA", templateType: "custom" });
    setDraftTemplateMeta("draft-B", { templateId: "tB", templateType: "scratch" });
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = JSON.parse(raw!);
    expect(Object.keys(parsed)).toHaveLength(2);
    expect(parsed["draft-A"]).toEqual({ templateId: "tA", templateType: "custom" });
    expect(parsed["draft-B"]).toEqual({ templateId: "tB", templateType: "scratch" });
  });
});

// ---------------------------------------------------------------------------
// removeDraftTemplateMeta
// ---------------------------------------------------------------------------

describe("removeDraftTemplateMeta", () => {
  it("removes the entry from the cache", () => {
    setDraftTemplateMeta("draft-X", { templateId: "tx", templateType: "custom" });
    removeDraftTemplateMeta("draft-X");
    expect(getDraftTemplateMeta("draft-X")).toBeNull();
  });

  it("leaves other entries intact after removal", () => {
    setDraftTemplateMeta("draft-keep", { templateId: "tk", templateType: "custom" });
    setDraftTemplateMeta("draft-remove", { templateId: "tr", templateType: "scratch" });
    removeDraftTemplateMeta("draft-remove");
    expect(getDraftTemplateMeta("draft-keep")).toEqual({
      templateId: "tk",
      templateType: "custom",
    });
    expect(getDraftTemplateMeta("draft-remove")).toBeNull();
  });

  it("is a no-op when key does not exist", () => {
    setDraftTemplateMeta("draft-real", { templateId: "t1", templateType: "custom" });
    expect(() => removeDraftTemplateMeta("nonexistent")).not.toThrow();
    expect(getDraftTemplateMeta("draft-real")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readCache — invalid JSON (catch branch)
// ---------------------------------------------------------------------------

describe("readCache — catch branch (invalid JSON)", () => {
  it("returns empty cache when localStorage contains invalid JSON", () => {
    localStorage.setItem(CACHE_KEY, "{ not: valid json }");
    // getDraftTemplateMeta reads cache → JSON.parse throws → catch → returns {}
    expect(getDraftTemplateMeta("any-key")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// writeCache — catch branch (localStorage.setItem throws)
// ---------------------------------------------------------------------------

describe("writeCache — catch branch (setItem throws)", () => {
  it("does not throw when localStorage.setItem fails", () => {
    const setItemSpy = jest.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => {
      setDraftTemplateMeta("draft-quota", { templateId: "tq", templateType: "scratch" });
    }).not.toThrow();

    setItemSpy.mockRestore();
  });
});
