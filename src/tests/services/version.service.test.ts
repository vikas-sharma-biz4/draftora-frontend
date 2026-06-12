/**
 * Tests for src/services/version.service.ts
 */

jest.mock("@/config/httpClient", () => ({
  http: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import {
  getVersionHistory,
  getVersion,
  createVersion,
  updateVersionDecision,
  regenerateFromVersion,
  saveEditedVersion,
} from "@/services/version.service";
import { http } from "@/config/httpClient";

const mockHttp = http as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rawVersion = {
  id: "v1-id",
  proposal_id: 1,
  version: 1,
  source: "generated",
  decision: "pending",
  snapshot: {},
  created_at: "2025-01-01T00:00:00Z",
  created_by: "user@example.com",
  parent_version: undefined,
  change_description: undefined,
};

const rawV2 = {
  ...rawVersion,
  id: "v2-id",
  version: 2,
  decision: "accepted",
};

const rawHistory = {
  proposal_id: 1,
  current_version: 2,
  versions: [rawVersion, rawV2],
  accepted_versions: [2],
  rejected_versions: [],
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getVersionHistory
// ---------------------------------------------------------------------------

describe("getVersionHistory", () => {
  it("calls http.get /proposals/:id/versions", async () => {
    mockHttp.get.mockResolvedValue(rawHistory);
    await getVersionHistory(1);
    expect(mockHttp.get).toHaveBeenCalledWith(
      "/proposals/1/versions",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("maps snake_case to camelCase", async () => {
    mockHttp.get.mockResolvedValue(rawHistory);
    const history = await getVersionHistory(1);
    expect(history.proposalId).toBe(1);
    expect(history.currentVersion).toBe(2);
    expect(history.acceptedVersions).toEqual([2]);
    expect(history.rejectedVersions).toEqual([]);
  });

  it("maps versions array", async () => {
    mockHttp.get.mockResolvedValue(rawHistory);
    const history = await getVersionHistory(1);
    expect(history.versions).toHaveLength(2);
    expect(history.versions[0].id).toBe("v1-id");
    expect(history.versions[0].proposalId).toBe(1);
    expect(history.versions[0].createdAt).toBe("2025-01-01T00:00:00Z");
  });

  it("propagates errors", async () => {
    mockHttp.get.mockRejectedValue(new Error("Not found"));
    await expect(getVersionHistory(99)).rejects.toThrow("Not found");
  });
});

// ---------------------------------------------------------------------------
// getVersion
// ---------------------------------------------------------------------------

describe("getVersion", () => {
  it("calls http.get /versions/:id", async () => {
    mockHttp.get.mockResolvedValue(rawVersion);
    await getVersion("v1-id");
    expect(mockHttp.get).toHaveBeenCalledWith(
      "/versions/v1-id",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("returns mapped ProposalVersion", async () => {
    mockHttp.get.mockResolvedValue(rawVersion);
    const version = await getVersion("v1-id");
    expect(version.id).toBe("v1-id");
    expect(version.version).toBe(1);
    expect(version.source).toBe("generated");
    expect(version.decision).toBe("pending");
  });

  it("maps optional fields", async () => {
    const withOptional = {
      ...rawVersion,
      created_by: "editor@example.com",
      parent_version: 1,
      change_description: "Initial version",
    };
    mockHttp.get.mockResolvedValue(withOptional);
    const version = await getVersion("v1-id");
    expect(version.createdBy).toBe("editor@example.com");
    expect(version.parentVersion).toBe(1);
    expect(version.changeDescription).toBe("Initial version");
  });
});

// ---------------------------------------------------------------------------
// createVersion
// ---------------------------------------------------------------------------

describe("createVersion", () => {
  it("calls http.post /versions with correct payload", async () => {
    mockHttp.post.mockResolvedValue(rawVersion);
    await createVersion({
      proposalId: 1,
      source: "generated",
      snapshot: {
        proposalData: {} as never,
        generatedContent: {},
        sectionTypes: {},
        metadata: {} as never,
      },
    });
    expect(mockHttp.post).toHaveBeenCalledWith(
      "/versions",
      expect.objectContaining({
        proposal_id: 1,
        source: "generated",
      })
    );
  });

  it("returns mapped ProposalVersion", async () => {
    mockHttp.post.mockResolvedValue(rawVersion);
    const result = await createVersion({
      proposalId: 1,
      source: "generated",
      snapshot: {
        proposalData: {} as never,
        generatedContent: {},
        sectionTypes: {},
        metadata: {} as never,
      },
    });
    expect(result.id).toBe("v1-id");
  });
});

// ---------------------------------------------------------------------------
// updateVersionDecision
// ---------------------------------------------------------------------------

describe("updateVersionDecision", () => {
  it("calls http.patch /versions/:id/decision", async () => {
    mockHttp.patch.mockResolvedValue({ ...rawVersion, decision: "accepted" });
    await updateVersionDecision({ versionId: "v1-id", decision: "accepted" });
    expect(mockHttp.patch).toHaveBeenCalledWith("/versions/v1-id/decision", {
      decision: "accepted",
    });
  });

  it("returns mapped version with new decision", async () => {
    mockHttp.patch.mockResolvedValue({ ...rawVersion, decision: "rejected" });
    const result = await updateVersionDecision({ versionId: "v1-id", decision: "rejected" });
    expect(result.decision).toBe("rejected");
  });

  it("propagates errors", async () => {
    mockHttp.patch.mockRejectedValue(new Error("Conflict"));
    await expect(updateVersionDecision({ versionId: "bad", decision: "accepted" })).rejects.toThrow(
      "Conflict"
    );
  });
});

// ---------------------------------------------------------------------------
// regenerateFromVersion
// ---------------------------------------------------------------------------

describe("regenerateFromVersion", () => {
  it("calls http.post /versions/:id/regenerate", async () => {
    mockHttp.post.mockResolvedValue({ proposal_id: 1, version_id: "v3-id" });
    await regenerateFromVersion({ versionId: "v2-id", modifications: { tone: "casual" } });
    expect(mockHttp.post).toHaveBeenCalledWith("/versions/v2-id/regenerate", {
      modifications: { tone: "casual" },
    });
  });

  it("returns camelCase proposalId and versionId", async () => {
    mockHttp.post.mockResolvedValue({ proposal_id: 42, version_id: "v3-new" });
    const result = await regenerateFromVersion({ versionId: "v2-id", modifications: {} });
    expect(result.proposalId).toBe(42);
    expect(result.versionId).toBe("v3-new");
  });
});

// ---------------------------------------------------------------------------
// saveEditedVersion
// ---------------------------------------------------------------------------

describe("saveEditedVersion", () => {
  it("calls http.post /versions/:id/edit", async () => {
    mockHttp.post.mockResolvedValue(rawVersion);
    await saveEditedVersion("v1-id", { intro: "New intro text" });
    expect(mockHttp.post).toHaveBeenCalledWith("/versions/v1-id/edit", {
      edited_content: { intro: "New intro text" },
    });
  });

  it("returns mapped ProposalVersion", async () => {
    mockHttp.post.mockResolvedValue({ ...rawVersion, version: 3 });
    const result = await saveEditedVersion("v1-id", {});
    expect(result.version).toBe(3);
  });

  it("propagates errors", async () => {
    mockHttp.post.mockRejectedValue(new Error("Save failed"));
    await expect(saveEditedVersion("bad-id", {})).rejects.toThrow("Save failed");
  });
});
