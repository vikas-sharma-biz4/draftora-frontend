/**
 * Tests for draftSlice Zustand store
 *
 * Coverage targets:
 *   - isCacheValid: uninitialized, within TTL, expired
 *   - getDraftById: found and not found
 *   - fetchDrafts: cache-hit skip, concurrent-guard skip, success, error
 *   - setDrafts, addDraft, updateDraft, removeDraft, removeAllDrafts, invalidateCache, reset
 *   - saveDraft: calls API, adds metadata to store, calls setDraftTemplateMeta
 *   - updateDraftApi: calls API, updates store entry, syncs template cache
 *   - deleteDraft: removes from store on success; rethrows on error
 *   - deleteAllDrafts: clears list on success; rethrows on error
 */

import { useDraftStore, INITIAL_DRAFT_STATE } from "@/store/features/drafts/draftSlice";
import * as draftApi from "@/services/draft.service";
import * as draftTemplateCache from "@/utils/draftTemplateCache";
import type { DraftMetadata, SavedDraft } from "@/interfaces/draftInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/draft.service", () => ({
  listDrafts: jest.fn(),
  saveDraft: jest.fn(),
  updateDraft: jest.fn(),
  getDraft: jest.fn(),
  deleteDraft: jest.fn(),
  deleteAllDrafts: jest.fn(),
}));

jest.mock("@/utils/draftTemplateCache", () => ({
  setDraftTemplateMeta: jest.fn(),
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockListDrafts = draftApi.listDrafts as jest.Mock;
const mockSaveDraft = draftApi.saveDraft as jest.Mock;
const mockUpdateDraft = draftApi.updateDraft as jest.Mock;
const mockGetDraft = draftApi.getDraft as jest.Mock;
const mockDeleteDraft = draftApi.deleteDraft as jest.Mock;
const mockDeleteAllDrafts = draftApi.deleteAllDrafts as jest.Mock;
const mockSetDraftTemplateMeta = draftTemplateCache.setDraftTemplateMeta as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDraftMeta(id: string, overrides: Partial<DraftMetadata> = {}): DraftMetadata {
  return {
    id,
    proposalId: null,
    title: `Draft ${id}`,
    clientName: "Acme Corp",
    status: "draft",
    lastLocation: "wizard_parameters",
    stage: "wizard_in_progress",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSavedDraft(id: string): SavedDraft {
  return {
    id,
    proposalId: null,
    title: `Draft ${id}`,
    clientName: "Acme Corp",
    status: "draft",
    lastLocation: "wizard_parameters",
    stage: "wizard_in_progress",
    wizardState: {
      currentStep: 1,
      maxStepReached: 1,
      completedSteps: [],
      proposalData: {} as never,
    },
    generatedContent: {},
    uiState: {
      scrollPosition: 0,
      activeSection: null,
      expandedSections: [],
      lastVisibleSection: null,
    },
    hasEdits: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    version: 1,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  useDraftStore.setState({ ...INITIAL_DRAFT_STATE });
});

// ---------------------------------------------------------------------------
// isCacheValid
// ---------------------------------------------------------------------------

describe("draftSlice — isCacheValid", () => {
  it("returns false when not initialized", () => {
    useDraftStore.setState({ isInitialized: false, lastFetched: null });
    expect(useDraftStore.getState().isCacheValid()).toBe(false);
  });

  it("returns false when lastFetched is null", () => {
    useDraftStore.setState({ isInitialized: true, lastFetched: null });
    expect(useDraftStore.getState().isCacheValid()).toBe(false);
  });

  it("returns true when lastFetched is within TTL (2 min)", () => {
    useDraftStore.setState({ isInitialized: true, lastFetched: Date.now() - 60_000 });
    expect(useDraftStore.getState().isCacheValid()).toBe(true);
  });

  it("returns false when lastFetched is beyond TTL", () => {
    useDraftStore.setState({ isInitialized: true, lastFetched: Date.now() - 3 * 60_000 });
    expect(useDraftStore.getState().isCacheValid()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getDraftById
// ---------------------------------------------------------------------------

describe("draftSlice — getDraftById", () => {
  it("returns the draft when it exists", () => {
    const draft = makeDraftMeta("abc");
    useDraftStore.setState({ drafts: [draft] });
    expect(useDraftStore.getState().getDraftById("abc")).toEqual(draft);
  });

  it("returns undefined when draft does not exist", () => {
    useDraftStore.setState({ drafts: [] });
    expect(useDraftStore.getState().getDraftById("missing")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fetchDrafts
// ---------------------------------------------------------------------------

describe("draftSlice — fetchDrafts", () => {
  it("skips fetch when cache is valid and force is false", async () => {
    useDraftStore.setState({ isInitialized: true, lastFetched: Date.now() });
    await useDraftStore.getState().fetchDrafts(false);
    expect(mockListDrafts).not.toHaveBeenCalled();
  });

  it("skips fetch when isLoading is true (concurrent guard)", async () => {
    useDraftStore.setState({ isLoading: true });
    await useDraftStore.getState().fetchDrafts(true);
    expect(mockListDrafts).not.toHaveBeenCalled();
  });

  it("forces fetch even when cache is valid when force=true", async () => {
    mockListDrafts.mockResolvedValueOnce([makeDraftMeta("a")]);
    useDraftStore.setState({ isInitialized: true, lastFetched: Date.now() });

    await useDraftStore.getState().fetchDrafts(true);

    expect(mockListDrafts).toHaveBeenCalledTimes(1);
  });

  it("sets drafts, isInitialized, and lastFetched on success", async () => {
    const drafts = [makeDraftMeta("a"), makeDraftMeta("b")];
    mockListDrafts.mockResolvedValueOnce(drafts);

    await useDraftStore.getState().fetchDrafts();

    const state = useDraftStore.getState();
    expect(state.drafts).toEqual(drafts);
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastFetched).not.toBeNull();
  });

  it("sets error and rethrows on API failure", async () => {
    mockListDrafts.mockRejectedValueOnce(new Error("Network error"));

    await expect(useDraftStore.getState().fetchDrafts()).rejects.toThrow("Network error");

    const state = useDraftStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe("Network error");
  });
});

// ---------------------------------------------------------------------------
// setDrafts / addDraft / updateDraft / removeDraft / removeAllDrafts
// ---------------------------------------------------------------------------

describe("draftSlice — basic list actions", () => {
  it("setDrafts replaces list and marks initialized", () => {
    const drafts = [makeDraftMeta("a"), makeDraftMeta("b")];
    useDraftStore.getState().setDrafts(drafts);
    const state = useDraftStore.getState();
    expect(state.drafts).toEqual(drafts);
    expect(state.isInitialized).toBe(true);
  });

  it("addDraft prepends to the list", () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("existing")] });
    useDraftStore.getState().addDraft(makeDraftMeta("new"));
    expect(useDraftStore.getState().drafts[0].id).toBe("new");
  });

  it("updateDraft merges fields into matching draft", () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("a")] });
    useDraftStore.getState().updateDraft("a", { title: "Updated Title" });
    expect(useDraftStore.getState().drafts[0].title).toBe("Updated Title");
  });

  it("removeDraft filters out matching draft", () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("a"), makeDraftMeta("b")] });
    useDraftStore.getState().removeDraft("a");
    expect(useDraftStore.getState().drafts).toHaveLength(1);
    expect(useDraftStore.getState().drafts[0].id).toBe("b");
  });

  it("removeAllDrafts empties the list", () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("a"), makeDraftMeta("b")] });
    useDraftStore.getState().removeAllDrafts();
    expect(useDraftStore.getState().drafts).toHaveLength(0);
  });

  it("invalidateCache clears lastFetched and isInitialized", () => {
    useDraftStore.setState({ lastFetched: Date.now(), isInitialized: true });
    useDraftStore.getState().invalidateCache();
    expect(useDraftStore.getState().lastFetched).toBeNull();
    expect(useDraftStore.getState().isInitialized).toBe(false);
  });

  it("reset returns to initial state", () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("a")], isInitialized: true });
    useDraftStore.getState().reset();
    expect(useDraftStore.getState().drafts).toEqual([]);
    expect(useDraftStore.getState().isInitialized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveDraft
// ---------------------------------------------------------------------------

describe("draftSlice — saveDraft", () => {
  it("calls the API and adds metadata to the store", async () => {
    const saved = makeSavedDraft("new-id");
    mockSaveDraft.mockResolvedValueOnce(saved);

    await useDraftStore.getState().saveDraft({
      title: "Draft title",
      clientName: "Acme",
      status: "draft",
      lastLocation: "wizard_parameters",
    });

    expect(mockSaveDraft).toHaveBeenCalledTimes(1);
    expect(useDraftStore.getState().drafts.find((d) => d.id === "new-id")).toBeDefined();
  });

  it("calls setDraftTemplateMeta when wizardState.proposalData includes template info", async () => {
    const saved = makeSavedDraft("tpl-draft");
    mockSaveDraft.mockResolvedValueOnce(saved);

    await useDraftStore.getState().saveDraft({
      title: "Tpl Draft",
      clientName: "Acme",
      status: "draft",
      lastLocation: "wizard_parameters",
      wizardState: {
        currentStep: 1,
        maxStepReached: 1,
        completedSteps: [],
        proposalData: { templateId: "saas-v1", templateType: "predefined" } as never,
      },
    });

    expect(mockSetDraftTemplateMeta).toHaveBeenCalledWith("tpl-draft", {
      templateId: "saas-v1",
      templateType: "predefined",
    });
  });

  it("returns the saved draft from the API", async () => {
    const saved = makeSavedDraft("ret-id");
    mockSaveDraft.mockResolvedValueOnce(saved);

    const result = await useDraftStore.getState().saveDraft({
      title: "t",
      clientName: "c",
      status: "draft",
      lastLocation: "wizard_parameters",
    });

    expect(result.id).toBe("ret-id");
  });
});

// ---------------------------------------------------------------------------
// updateDraftApi
// ---------------------------------------------------------------------------

describe("draftSlice — updateDraftApi", () => {
  it("calls the API and updates the matching draft in store", async () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("upd-id")] });
    const updated = makeSavedDraft("upd-id");
    updated.title = "Updated Title";
    mockUpdateDraft.mockResolvedValueOnce(updated);

    await useDraftStore.getState().updateDraftApi("upd-id", { title: "Updated Title" });

    expect(useDraftStore.getState().drafts.find((d) => d.id === "upd-id")?.title).toBe(
      "Updated Title"
    );
  });

  it("syncs template cache when wizardState.proposalData is in the payload", async () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("tpl-upd")] });
    mockUpdateDraft.mockResolvedValueOnce(makeSavedDraft("tpl-upd"));

    await useDraftStore.getState().updateDraftApi("tpl-upd", {
      wizardState: {
        currentStep: 2,
        maxStepReached: 2,
        completedSteps: [1],
        proposalData: { templateId: "mvp-v1", templateType: "custom" } as never,
      },
    });

    expect(mockSetDraftTemplateMeta).toHaveBeenCalledWith("tpl-upd", {
      templateId: "mvp-v1",
      templateType: "custom",
    });
  });
});

// ---------------------------------------------------------------------------
// getDraft (pass-through)
// ---------------------------------------------------------------------------

describe("draftSlice — getDraft", () => {
  it("delegates to the API and returns the result", async () => {
    const saved = makeSavedDraft("get-id");
    mockGetDraft.mockResolvedValueOnce(saved);

    const result = await useDraftStore.getState().getDraft("get-id");

    expect(mockGetDraft).toHaveBeenCalledWith("get-id");
    expect(result.id).toBe("get-id");
  });
});

// ---------------------------------------------------------------------------
// deleteDraft
// ---------------------------------------------------------------------------

describe("draftSlice — deleteDraft", () => {
  it("removes draft from store on success", async () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("del-1"), makeDraftMeta("del-2")] });
    mockDeleteDraft.mockResolvedValueOnce(undefined);

    await useDraftStore.getState().deleteDraft("del-1");

    expect(useDraftStore.getState().drafts.find((d) => d.id === "del-1")).toBeUndefined();
    expect(useDraftStore.getState().drafts).toHaveLength(1);
  });

  it("rethrows on API error and does not remove from store", async () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("del-err")] });
    mockDeleteDraft.mockRejectedValueOnce(new Error("Delete failed"));

    await expect(useDraftStore.getState().deleteDraft("del-err")).rejects.toThrow("Delete failed");

    expect(useDraftStore.getState().drafts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// deleteAllDrafts
// ---------------------------------------------------------------------------

describe("draftSlice — deleteAllDrafts", () => {
  it("clears all drafts from store on success", async () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("a"), makeDraftMeta("b")] });
    mockDeleteAllDrafts.mockResolvedValueOnce(undefined);

    await useDraftStore.getState().deleteAllDrafts();

    expect(useDraftStore.getState().drafts).toHaveLength(0);
  });

  it("rethrows on API error and leaves store unchanged", async () => {
    useDraftStore.setState({ drafts: [makeDraftMeta("a")] });
    mockDeleteAllDrafts.mockRejectedValueOnce(new Error("Bulk delete failed"));

    await expect(useDraftStore.getState().deleteAllDrafts()).rejects.toThrow("Bulk delete failed");

    expect(useDraftStore.getState().drafts).toHaveLength(1);
  });
});
