/**
 * Tests for draft.service.ts
 *
 * Coverage targets:
 *   - parseDraftStage: valid stages and unknown fallback
 *   - parseDraftLocation: valid locations and unknown fallback
 *   - mapWizardState: snake_case → camelCase mapping
 *   - mapUIState: snake_case → camelCase mapping
 *   - mapSavedDraft: full draft mapping with runtime validation
 *   - saveDraft / updateDraft / getDraft / listDrafts: API call shape
 *   - getDraftByProposalId: targeted query, null on empty
 *   - deleteDraft / deleteAllDrafts: void returns
 */

import {
  saveDraft,
  updateDraft,
  getDraft,
  listDrafts,
  getDraftByProposalId,
  deleteDraft,
  deleteAllDrafts,
} from "@/services/draft.service";
import { http } from "@/config/httpClient";
import type { SaveDraftPayload } from "@/interfaces/draftInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/config/httpClient", () => ({
  http: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  buildUrl: jest.fn(),
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockHttpGet = http.get as jest.Mock;
const mockHttpPost = http.post as jest.Mock;
const mockHttpPut = http.put as jest.Mock;
const mockHttpDelete = http.delete as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// wizard_state and ui_state use camelCase because the client sends them as-is
// (the backend stores and returns the nested JS object without snake_case conversion).
// Top-level draft fields use snake_case (standard backend serialisation).
const rawSavedDraft = {
  id: "draft-1",
  proposal_id: 42,
  title: "Test Proposal",
  client_name: "Acme Corp",
  status: "draft",
  last_location: "wizard_parameters",
  stage: "wizard_in_progress",
  wizard_state: {
    currentStep: 2,
    maxStepReached: 3,
    completedSteps: [1, 2],
    proposalData: { title: "Test Proposal", clientName: "Acme Corp" },
  },
  generated_content: { executive_summary: "Some content" },
  ui_state: {
    scrollPosition: 150,
    activeSection: "executive_summary",
    expandedSections: ["executive_summary", "proposed_solution"],
    lastVisibleSection: "proposed_solution",
  },
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  version: 3,
};

const rawDraftListItem = {
  id: "draft-1",
  proposal_id: 42,
  title: "Test Proposal",
  client_name: "Acme Corp",
  status: "draft",
  last_location: "wizard_parameters",
  stage: "wizard_in_progress",
  updated_at: "2025-01-02T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// parseDraftStage (tested indirectly through mapSavedDraft / listDrafts)
// ---------------------------------------------------------------------------

describe("draft.service — parseDraftStage", () => {
  it("maps valid stage 'wizard_in_progress' without mutation", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [rawDraftListItem] });
    const result = await listDrafts();
    expect(result[0].stage).toBe("wizard_in_progress");
  });

  it("defaults unknown stage to 'template_selection'", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [{ ...rawDraftListItem, stage: "unknown_stage" }] });
    const result = await listDrafts();
    expect(result[0].stage).toBe("template_selection");
  });
});

// ---------------------------------------------------------------------------
// parseDraftLocation (tested indirectly through mapSavedDraft / listDrafts)
// ---------------------------------------------------------------------------

describe("draft.service — parseDraftLocation", () => {
  it("maps valid location 'wizard_review' without mutation", async () => {
    mockHttpGet.mockResolvedValue({
      drafts: [{ ...rawDraftListItem, last_location: "wizard_review" }],
    });
    const result = await listDrafts();
    expect(result[0].lastLocation).toBe("wizard_review");
  });

  it("defaults unknown location to 'wizard_parameters'", async () => {
    mockHttpGet.mockResolvedValue({
      drafts: [{ ...rawDraftListItem, last_location: "unknown_location" }],
    });
    const result = await listDrafts();
    expect(result[0].lastLocation).toBe("wizard_parameters");
  });
});

// ---------------------------------------------------------------------------
// mapWizardState (tested through getDraft)
// ---------------------------------------------------------------------------

describe("draft.service — mapWizardState", () => {
  it("maps snake_case wizard state to camelCase", async () => {
    mockHttpGet.mockResolvedValue(rawSavedDraft);
    const result = await getDraft("draft-1");
    expect(result.wizardState).toEqual({
      currentStep: 2,
      maxStepReached: 3,
      completedSteps: [1, 2],
      proposalData: rawSavedDraft.wizard_state.proposalData,
    });
  });
});

// ---------------------------------------------------------------------------
// mapUIState (tested through getDraft)
// ---------------------------------------------------------------------------

describe("draft.service — mapUIState", () => {
  it("maps snake_case UI state to camelCase", async () => {
    mockHttpGet.mockResolvedValue(rawSavedDraft);
    const result = await getDraft("draft-1");
    expect(result.uiState).toEqual({
      scrollPosition: 150,
      activeSection: "executive_summary",
      expandedSections: ["executive_summary", "proposed_solution"],
      lastVisibleSection: "proposed_solution",
    });
  });
});

// ---------------------------------------------------------------------------
// mapSavedDraft (tested through getDraft)
// ---------------------------------------------------------------------------

describe("draft.service — mapSavedDraft", () => {
  it("maps full raw draft to SavedDraft with all fields", async () => {
    mockHttpGet.mockResolvedValue(rawSavedDraft);
    const result = await getDraft("draft-1");
    expect(result).toEqual({
      id: "draft-1",
      proposalId: 42,
      title: "Test Proposal",
      clientName: "Acme Corp",
      status: "draft",
      lastLocation: "wizard_parameters",
      stage: "wizard_in_progress",
      hasEdits: false,
      wizardState: {
        currentStep: 2,
        maxStepReached: 3,
        completedSteps: [1, 2],
        proposalData: rawSavedDraft.wizard_state.proposalData,
      },
      generatedContent: { executive_summary: "Some content" },
      uiState: {
        scrollPosition: 150,
        activeSection: "executive_summary",
        expandedSections: ["executive_summary", "proposed_solution"],
        lastVisibleSection: "proposed_solution",
      },
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-02T00:00:00Z",
      version: 3,
    });
  });

  it("maps null proposal_id correctly", async () => {
    mockHttpGet.mockResolvedValue({ ...rawSavedDraft, proposal_id: null });
    const result = await getDraft("draft-1");
    expect(result.proposalId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveDraft
// ---------------------------------------------------------------------------

describe("draft.service — saveDraft", () => {
  const payload: SaveDraftPayload = {
    proposalId: 42,
    title: "New Proposal",
    clientName: "Client X",
    status: "draft",
    lastLocation: "wizard_parameters",
    stage: "wizard_in_progress",
    wizardState: {
      proposalData: {} as never,
      currentStep: 2,
      maxStepReached: 2,
      completedSteps: [1],
    },
    generatedContent: {},
    uiState: {
      scrollPosition: 0,
      activeSection: null,
      expandedSections: [],
      lastVisibleSection: null,
    },
  };

  it("calls http.post with /drafts/ and snake_case body", async () => {
    mockHttpPost.mockResolvedValue(rawSavedDraft);
    await saveDraft(payload);
    expect(mockHttpPost).toHaveBeenCalledWith(
      "/drafts",
      expect.objectContaining({
        proposal_id: 42,
        client_name: "Client X",
        last_location: "wizard_parameters",
        stage: "wizard_in_progress",
      })
    );
  });

  it("returns mapped SavedDraft", async () => {
    mockHttpPost.mockResolvedValue(rawSavedDraft);
    const result = await saveDraft(payload);
    expect(result.id).toBe("draft-1");
    expect(result.proposalId).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// updateDraft
// ---------------------------------------------------------------------------

describe("draft.service — updateDraft", () => {
  it("calls http.put with /drafts/:id and snake_case body", async () => {
    mockHttpPut.mockResolvedValue(rawSavedDraft);
    await updateDraft("draft-1", { title: "Updated" });
    expect(mockHttpPut).toHaveBeenCalledWith(
      "/drafts/draft-1",
      expect.objectContaining({
        title: "Updated",
      })
    );
  });
});

// ---------------------------------------------------------------------------
// getDraft
// ---------------------------------------------------------------------------

describe("draft.service — getDraft", () => {
  it("calls http.get with /drafts/:id and no-store cache", async () => {
    mockHttpGet.mockResolvedValue(rawSavedDraft);
    await getDraft("draft-1");
    expect(mockHttpGet).toHaveBeenCalledWith("/drafts/draft-1", { cache: "no-store" });
  });
});

// ---------------------------------------------------------------------------
// listDrafts
// ---------------------------------------------------------------------------

describe("draft.service — listDrafts", () => {
  it("calls http.get with /drafts when no params", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [rawDraftListItem] });
    await listDrafts();
    expect(mockHttpGet).toHaveBeenCalledWith("/drafts", { cache: "no-store" });
  });

  it("appends limit and offset query params", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [rawDraftListItem] });
    await listDrafts({ limit: 10, offset: 20 });
    expect(mockHttpGet).toHaveBeenCalledWith("/drafts?limit=10&offset=20", { cache: "no-store" });
  });

  it("maps each item to DraftMetadata with camelCase fields", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [rawDraftListItem] });
    const result = await listDrafts();
    expect(result).toMatchObject([
      {
        id: "draft-1",
        proposalId: 42,
        title: "Test Proposal",
        clientName: "Acme Corp",
        status: "draft",
        lastLocation: "wizard_parameters",
        stage: "wizard_in_progress",
        updatedAt: "2025-01-02T00:00:00Z",
      },
    ]);
  });

  it("returns empty array when API returns empty", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [] });
    const result = await listDrafts();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDraftByProposalId
// ---------------------------------------------------------------------------

describe("draft.service — getDraftByProposalId", () => {
  it("returns first mapped draft when found", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [rawDraftListItem] });
    const result = await getDraftByProposalId(42);
    expect(result).not.toBeNull();
    expect(result?.proposalId).toBe(42);
    expect(mockHttpGet).toHaveBeenCalledWith("/drafts?proposal_id=42", { cache: "no-store" });
  });

  it("returns null when no drafts match", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [] });
    const result = await getDraftByProposalId(999);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteDraft
// ---------------------------------------------------------------------------

describe("draft.service — deleteDraft", () => {
  it("calls http.delete with /drafts/:id", async () => {
    mockHttpDelete.mockResolvedValue(null);
    await deleteDraft("draft-1");
    expect(mockHttpDelete).toHaveBeenCalledWith("/drafts/draft-1");
  });
});

// ---------------------------------------------------------------------------
// deleteAllDrafts
// ---------------------------------------------------------------------------

describe("draft.service — deleteAllDrafts", () => {
  it("calls http.delete with /drafts?confirm=delete-all", async () => {
    mockHttpDelete.mockResolvedValue(null);
    await deleteAllDrafts();
    expect(mockHttpDelete).toHaveBeenCalledWith("/drafts?confirm=delete-all");
  });
});

// ---------------------------------------------------------------------------
// parseDraftStatus — missing branch: unknown status fallback
// ---------------------------------------------------------------------------

describe("draft.service — parseDraftStatus (unknown fallback)", () => {
  it("defaults unknown status to 'draft' and returns mapped draft", async () => {
    mockHttpGet.mockResolvedValue({
      drafts: [{ ...rawDraftListItem, status: "unknown_status_xyz" }],
    });
    const result = await listDrafts();
    expect(result[0].status).toBe("draft");
  });
});

// ---------------------------------------------------------------------------
// listDrafts — missing branches
// ---------------------------------------------------------------------------

describe("draft.service — listDrafts (additional branches)", () => {
  it("appends only limit when offset is absent", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [] });
    await listDrafts({ limit: 5 });
    expect(mockHttpGet).toHaveBeenCalledWith("/drafts?limit=5", { cache: "no-store" });
  });

  it("appends only offset when limit is absent", async () => {
    mockHttpGet.mockResolvedValue({ drafts: [] });
    await listDrafts({ offset: 20 });
    expect(mockHttpGet).toHaveBeenCalledWith("/drafts?offset=20", { cache: "no-store" });
  });

  it("returns empty array when response is not an envelope (missing drafts key)", async () => {
    mockHttpGet.mockResolvedValue(null);
    const result = await listDrafts();
    expect(result).toEqual([]);
  });

  it("returns empty array when response is a plain string (non-object)", async () => {
    mockHttpGet.mockResolvedValue("unexpected string");
    const result = await listDrafts();
    expect(result).toEqual([]);
  });

  it("maps has_edits=true correctly", async () => {
    mockHttpGet.mockResolvedValue({
      drafts: [{ ...rawDraftListItem, has_edits: true }],
    });
    const result = await listDrafts();
    expect(result[0].hasEdits).toBe(true);
  });

  it("defaults hasEdits to false when has_edits is absent", async () => {
    const { has_edits: _, ...itemWithoutEdits } = rawDraftListItem as typeof rawDraftListItem & {
      has_edits?: boolean;
    };
    mockHttpGet.mockResolvedValue({ drafts: [itemWithoutEdits] });
    const result = await listDrafts();
    expect(result[0].hasEdits).toBe(false);
  });

  it("maps templateId and templateType when present", async () => {
    mockHttpGet.mockResolvedValue({
      drafts: [{ ...rawDraftListItem, template_id: "tmpl-1", template_type: "predefined" }],
    });
    const result = await listDrafts();
    expect(result[0].templateId).toBe("tmpl-1");
    expect(result[0].templateType).toBe("predefined");
  });

  it("returns empty array when 'drafts' key exists but is not an array (line 289-290)", async () => {
    // envelope has 'drafts' key → data = 42 (non-array) → !Array.isArray(data) → return []
    mockHttpGet.mockResolvedValue({ drafts: 42 });
    const result = await listDrafts();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDraftByProposalId — missing branches
// ---------------------------------------------------------------------------

describe("draft.service — getDraftByProposalId (additional branches)", () => {
  it("returns null when API response is not an envelope with 'drafts'", async () => {
    mockHttpGet.mockResolvedValue(null);
    const result = await getDraftByProposalId(42);
    expect(result).toBeNull();
  });

  it("returns null on 404 HttpError", async () => {
    const { HttpError } = jest.requireMock("@/config/httpClient") as {
      HttpError: new (code: number, msg: string) => Error & { statusCode: number };
    };
    mockHttpGet.mockRejectedValue(new HttpError(404, "Not Found"));
    const result = await getDraftByProposalId(42);
    expect(result).toBeNull();
  });

  it("returns null on non-404 errors (network error, 500)", async () => {
    mockHttpGet.mockRejectedValue(new Error("Network error"));
    const result = await getDraftByProposalId(42);
    expect(result).toBeNull();
  });

  it("maps has_edits=true on the found draft", async () => {
    mockHttpGet.mockResolvedValue({
      drafts: [{ ...rawDraftListItem, has_edits: true }],
    });
    const result = await getDraftByProposalId(42);
    expect(result?.hasEdits).toBe(true);
  });

  it("returns null when 'drafts' key exists but is not an array (line 328-329)", async () => {
    // response has 'drafts' key so data = "not-an-array" → !Array.isArray(data) hits
    mockHttpGet.mockResolvedValue({ drafts: "not-an-array" });
    const result = await getDraftByProposalId(42);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveDraft — hasEdits branch
// ---------------------------------------------------------------------------

describe("draft.service — saveDraft (hasEdits branch)", () => {
  it("includes has_edits in body when hasEdits is explicitly set to true", async () => {
    mockHttpPost.mockResolvedValue(rawSavedDraft);
    const payload: import("@/interfaces/draftInterfaces").SaveDraftPayload = {
      proposalId: 42,
      title: "New Proposal",
      clientName: "Client X",
      status: "draft",
      lastLocation: "wizard_parameters",
      stage: "wizard_in_progress",
      wizardState: {
        proposalData: {} as never,
        currentStep: 2,
        maxStepReached: 2,
        completedSteps: [1],
      },
      generatedContent: {},
      uiState: {
        scrollPosition: 0,
        activeSection: null,
        expandedSections: [],
        lastVisibleSection: null,
      },
      hasEdits: true,
    };
    await saveDraft(payload);
    const body = mockHttpPost.mock.calls[0][1];
    expect(body.has_edits).toBe(true);
  });

  it("omits has_edits from body when hasEdits is undefined", async () => {
    mockHttpPost.mockResolvedValue(rawSavedDraft);
    const payload: import("@/interfaces/draftInterfaces").SaveDraftPayload = {
      proposalId: 42,
      title: "New Proposal",
      clientName: "Client X",
      status: "draft",
      lastLocation: "wizard_parameters",
      stage: "wizard_in_progress",
      wizardState: {
        proposalData: {} as never,
        currentStep: 1,
        maxStepReached: 1,
        completedSteps: [],
      },
      generatedContent: {},
      uiState: {
        scrollPosition: 0,
        activeSection: null,
        expandedSections: [],
        lastVisibleSection: null,
      },
    };
    await saveDraft(payload);
    const body = mockHttpPost.mock.calls[0][1];
    expect(body).not.toHaveProperty("has_edits");
  });
});

// ---------------------------------------------------------------------------
// updateDraft — hasEdits branch
// ---------------------------------------------------------------------------

describe("draft.service — updateDraft (hasEdits branch)", () => {
  it("includes has_edits=false in body when hasEdits is explicitly false", async () => {
    mockHttpPut.mockResolvedValue(rawSavedDraft);
    await updateDraft("draft-1", { hasEdits: false });
    const body = mockHttpPut.mock.calls[0][1];
    expect(body.has_edits).toBe(false);
  });

  it("omits has_edits when hasEdits is undefined", async () => {
    mockHttpPut.mockResolvedValue(rawSavedDraft);
    await updateDraft("draft-1", { title: "Updated" });
    const body = mockHttpPut.mock.calls[0][1];
    expect(body).not.toHaveProperty("has_edits");
  });
});
