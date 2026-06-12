/**
 * Tests for src/utils/proposalVersionCache.ts
 */

import { setProposalHistoryVersion, getProposalHistoryVersion } from "@/utils/proposalVersionCache";

const CACHE_KEY = "proposal_history_versions_v1";

beforeEach(() => {
  localStorage.clear();
});

describe("setProposalHistoryVersion", () => {
  it("stores the version in localStorage", () => {
    setProposalHistoryVersion(1, "v1");
    const raw = localStorage.getItem(CACHE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed[1]).toBe("v1");
  });

  it("stores multiple proposal versions", () => {
    setProposalHistoryVersion(1, "v1");
    setProposalHistoryVersion(2, "v2");
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY)!);
    expect(parsed[1]).toBe("v1");
    expect(parsed[2]).toBe("v2");
  });

  it("overwrites existing version for same proposalId", () => {
    setProposalHistoryVersion(5, "v1");
    setProposalHistoryVersion(5, "v2");
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY)!);
    expect(parsed[5]).toBe("v2");
  });
});

describe("getProposalHistoryVersion", () => {
  it("returns null when no entry exists", () => {
    expect(getProposalHistoryVersion(99)).toBeNull();
  });

  it("returns the stored version", () => {
    setProposalHistoryVersion(3, "v2");
    expect(getProposalHistoryVersion(3)).toBe("v2");
  });

  it("returns null for a different proposalId than stored", () => {
    setProposalHistoryVersion(1, "v1");
    expect(getProposalHistoryVersion(2)).toBeNull();
  });

  it("returns null when localStorage has corrupted JSON", () => {
    localStorage.setItem(CACHE_KEY, "not-json");
    expect(getProposalHistoryVersion(1)).toBeNull();
  });
});
