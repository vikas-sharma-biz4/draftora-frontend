/**
 * Tests for src/services/proposal/proposalVersioning.service.ts
 *
 * Coverage targets:
 *   createVersionDraft:
 *     - POSTs to the correct endpoint with trigger payload
 *     - maps snake_case API response to camelCase VersionDraftOut
 *     - accepts all valid VersionDraftTrigger values
 *     - propagates HTTP errors
 *   getProposalFamilyTree:
 *     - GETs the correct endpoint with cache: no-store
 *     - maps root_id to rootId
 *     - maps each version item from snake_case to camelCase
 *     - returns an empty versions array when API returns none
 *     - propagates HTTP errors
 *   deleteVersionDraft:
 *     - DELETEs the correct endpoint
 *     - resolves without a return value on success
 *     - propagates HTTP errors
 */

jest.mock("@/config/httpClient", () => ({
  http: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  createVersionDraft,
  getProposalFamilyTree,
  deleteVersionDraft,
} from "@/services/proposal/proposalVersioning.service";
import { http } from "@/config/httpClient";

const mockPost = http.post as jest.Mock;
const mockGet = http.get as jest.Mock;
const mockDelete = http.delete as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rawVersionDraftOut = {
  id: 42,
  version_label: "1.1",
  parent_proposal_id: 10,
  root_proposal_id: 10,
  approval_status: "pending",
  status: "draft",
  title: "My Proposal v1.1",
  created_at: "2026-06-18T12:00:00Z",
};

const rawFamilyTreeResponse = {
  root_id: 10,
  versions: [
    {
      id: 10,
      version_label: "1.0",
      approval_status: "approved",
      status: "completed",
      title: "My Proposal",
      created_at: "2026-06-01T10:00:00Z",
      updated_at: "2026-06-02T10:00:00Z",
    },
    {
      id: 42,
      version_label: "1.1",
      approval_status: "pending",
      status: "draft",
      title: "My Proposal v1.1",
      created_at: "2026-06-18T12:00:00Z",
      updated_at: "2026-06-18T12:00:00Z",
    },
  ],
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// createVersionDraft
// ---------------------------------------------------------------------------

describe("createVersionDraft", () => {
  it("POSTs to the correct endpoint with the trigger payload", async () => {
    mockPost.mockResolvedValueOnce(rawVersionDraftOut);
    await createVersionDraft(10, "section_edit");
    expect(mockPost).toHaveBeenCalledWith("/proposals/10/create-version-draft", {
      trigger: "section_edit",
    });
  });

  it.each(["section_edit", "review_edit", "duplicate", "restore"] as const)(
    "accepts trigger '%s' without error",
    async (trigger) => {
      mockPost.mockResolvedValueOnce(rawVersionDraftOut);
      await expect(createVersionDraft(10, trigger)).resolves.not.toThrow();
    }
  );

  it("maps snake_case API response to camelCase VersionDraftOut", async () => {
    mockPost.mockResolvedValueOnce(rawVersionDraftOut);
    const result = await createVersionDraft(10, "section_edit");
    expect(result).toEqual({
      id: 42,
      versionLabel: "1.1",
      parentProposalId: 10,
      rootProposalId: 10,
      approvalStatus: "pending",
      status: "draft",
      title: "My Proposal v1.1",
      createdAt: "2026-06-18T12:00:00Z",
    });
  });

  it("does not retain any raw snake_case keys in the returned object", async () => {
    mockPost.mockResolvedValueOnce(rawVersionDraftOut);
    const result = await createVersionDraft(10, "section_edit");
    expect(result).not.toHaveProperty("version_label");
    expect(result).not.toHaveProperty("parent_proposal_id");
    expect(result).not.toHaveProperty("root_proposal_id");
    expect(result).not.toHaveProperty("approval_status");
    expect(result).not.toHaveProperty("created_at");
  });

  it("propagates errors thrown by http.post", async () => {
    mockPost.mockRejectedValueOnce(new Error("Network error"));
    await expect(createVersionDraft(10, "duplicate")).rejects.toThrow("Network error");
  });
});

// ---------------------------------------------------------------------------
// getProposalFamilyTree
// ---------------------------------------------------------------------------

describe("getProposalFamilyTree", () => {
  it("GETs the family endpoint with cache: no-store to prevent stale data", async () => {
    mockGet.mockResolvedValueOnce(rawFamilyTreeResponse);
    await getProposalFamilyTree(10);
    expect(mockGet).toHaveBeenCalledWith("/proposals/10/family", { cache: "no-store" });
  });

  it("maps root_id to rootId", async () => {
    mockGet.mockResolvedValueOnce(rawFamilyTreeResponse);
    const result = await getProposalFamilyTree(10);
    expect(result.rootId).toBe(10);
  });

  it("maps each version item from snake_case to camelCase", async () => {
    mockGet.mockResolvedValueOnce(rawFamilyTreeResponse);
    const result = await getProposalFamilyTree(10);
    expect(result.versions).toHaveLength(2);
    expect(result.versions[0]).toEqual({
      id: 10,
      versionLabel: "1.0",
      approvalStatus: "approved",
      status: "completed",
      title: "My Proposal",
      createdAt: "2026-06-01T10:00:00Z",
      updatedAt: "2026-06-02T10:00:00Z",
    });
    expect(result.versions[1]).toMatchObject({
      id: 42,
      versionLabel: "1.1",
      approvalStatus: "pending",
    });
  });

  it("returns an empty versions array when the API returns none", async () => {
    mockGet.mockResolvedValueOnce({ root_id: 5, versions: [] });
    const result = await getProposalFamilyTree(5);
    expect(result.versions).toEqual([]);
    expect(result.rootId).toBe(5);
  });

  it("propagates errors thrown by http.get", async () => {
    mockGet.mockRejectedValueOnce(new Error("Not found"));
    await expect(getProposalFamilyTree(99)).rejects.toThrow("Not found");
  });
});

// ---------------------------------------------------------------------------
// deleteVersionDraft
// ---------------------------------------------------------------------------

describe("deleteVersionDraft", () => {
  it("DELETEs the correct version-draft endpoint", async () => {
    mockDelete.mockResolvedValueOnce(null);
    await deleteVersionDraft(42);
    expect(mockDelete).toHaveBeenCalledWith("/proposals/42/version-draft");
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("resolves without a return value on success", async () => {
    mockDelete.mockResolvedValueOnce(null);
    await expect(deleteVersionDraft(42)).resolves.toBeUndefined();
  });

  it("propagates errors thrown by http.delete", async () => {
    mockDelete.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(deleteVersionDraft(42)).rejects.toThrow("Forbidden");
  });
});
