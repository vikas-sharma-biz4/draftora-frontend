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

const rawSavedDraft = {
  id: "draft-1",
  proposal_id: 42,
  title: "Test Proposal",
  client_name: "Acme Corp",
  status: "draft",
  last_location: "wizard_parameters",
  stage: "wizard_in_progress",
  wizard_state: {
    current_step: 2,
    max_step_reached: 3,
    completed_steps: [1, 2],
    proposal_data: { title: "Test Proposal", clientName: "Acme Corp" },
  },
  generated_content: { executive_summary: "Some content" },
  ui_state: {
    scroll_position: 150,
    active_section: "executive_summary",
    expanded_sections: ["executive_summary", "proposed_solution"],
    last_visible_section: "proposed_solution",
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
    mockHttpGet.mockResolvedValue([rawDraftListItem]);
    const result = await listDrafts();
    expect(result[0].stage).toBe("wizard_in_progress");
  });

  it("defaults unknown stage to 'template_selection'", async () => {
    mockHttpGet.mockResolvedValue([
      { ...rawDraftListItem, stage: "unknown_stage" },
    ]);
    const result = await listDrafts();
    expect(result[0].stage).toBe("template_selection");
  });
});

// ---------------------------------------------------------------------------
// parseDraftLocation (tested indirectly through mapSavedDraft / listDrafts)
// ---------------------------------------------------------------------------

describe("draft.service — parseDraftLocation", () => {
  it("maps valid location 'wizard_review' without mutation", async () => {
    mockHttpGet.mockResolvedValue([
      { ...rawDraftListItem, last_location: "wizard_review" },
    ]);
    const result = await listDrafts();
    expect(result[0].lastLocation).toBe("wizard_review");
  });

  it("defaults unknown location to 'wizard_parameters'", async () => {
    mockHttpGet.mockResolvedValue([
      { ...rawDraftListItem, last_location: "unknown_location" },
    ]);
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
      proposalData: rawSavedDraft.wizard_state.proposal_data,
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
      wizardState: {
        currentStep: 2,
        maxStepReached: 3,
        completedSteps: [1, 2],
        proposalData: rawSavedDraft.wizard_state.proposal_data,
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
    expect(mockHttpPost).toHaveBeenCalledWith("/drafts/", expect.objectContaining({
      proposal_id: 42,
      client_name: "Client X",
      last_location: "wizard_parameters",
      stage: "wizard_in_progress",
    }));
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
  it("calls http.put with /drafts/:id/ and snake_case body", async () => {
    mockHttpPut.mockResolvedValue(rawSavedDraft);
    await updateDraft("draft-1", { title: "Updated" });
    expect(mockHttpPut).toHaveBeenCalledWith("/drafts/draft-1/", expect.objectContaining({
      title: "Updated",
    }));
  });
});

// ---------------------------------------------------------------------------
// getDraft
// ---------------------------------------------------------------------------

describe("draft.service — getDraft", () => {
  it("calls http.get with /drafts/:id/ and no-store cache", async () => {
    mockHttpGet.mockResolvedValue(rawSavedDraft);
    await getDraft("draft-1");
    expect(mockHttpGet).toHaveBeenCalledWith("/drafts/draft-1/", { cache: "no-store" });
  });
});

// ---------------------------------------------------------------------------
// listDrafts
// ---------------------------------------------------------------------------

describe("draft.service — listDrafts", () => {
  it("calls http.get with /drafts/ when no params", async () => {
    mockHttpGet.mockResolvedValue([rawDraftListItem]);
    await listDrafts();
    expect(mockHttpGet).toHaveBeenCalledWith("/drafts/", { cache: "no-store" });
  });

  it("appends limit and offset query params", async () => {
    mockHttpGet.mockResolvedValue([rawDraftListItem]);
    await listDrafts({ limit: 10, offset: 20 });
    expect(mockHttpGet).toHaveBeenCalledWith(
      "/drafts/?limit=10&offset=20",
      { cache: "no-store" }
    );
  });

  it("maps each item to DraftMetadata with camelCase fields", async () => {
    mockHttpGet.mockResolvedValue([rawDraftListItem]);
    const result = await listDrafts();
    expect(result).toEqual([
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
    mockHttpGet.mockResolvedValue([]);
    const result = await listDrafts();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDraftByProposalId
// ---------------------------------------------------------------------------

describe("draft.service — getDraftByProposalId", () => {
  it("returns first mapped draft when found", async () => {
    mockHttpGet.mockResolvedValue([rawDraftListItem]);
    const result = await getDraftByProposalId(42);
    expect(result).not.toBeNull();
    expect(result?.proposalId).toBe(42);
    expect(mockHttpGet).toHaveBeenCalledWith(
      "/drafts/?proposal_id=42",
      { cache: "no-store" }
    );
  });

  it("returns null when no drafts match", async () => {
    mockHttpGet.mockResolvedValue([]);
    const result = await getDraftByProposalId(999);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteDraft
// ---------------------------------------------------------------------------

describe("draft.service — deleteDraft", () => {
  it("calls http.delete with /drafts/:id/", async () => {
    mockHttpDelete.mockResolvedValue(null);
    await deleteDraft("draft-1");
    expect(mockHttpDelete).toHaveBeenCalledWith("/drafts/draft-1/");
  });
});

// ---------------------------------------------------------------------------
// deleteAllDrafts
// ---------------------------------------------------------------------------

describe("draft.service — deleteAllDrafts", () => {
  it("calls http.delete with /drafts/", async () => {
    mockHttpDelete.mockResolvedValue(null);
    await deleteAllDrafts();
    expect(mockHttpDelete).toHaveBeenCalledWith("/drafts/");
  });
});
