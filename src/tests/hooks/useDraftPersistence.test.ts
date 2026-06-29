/**
 * Tests for useDraftPersistence hook
 *
 * Coverage targets:
 *   - Does not save when enabled=false
 *   - Does not save when proposalId is null
 *   - Does not save when proposal is null
 *   - Calls updateDraftApi when draftId already known
 *   - Calls saveDraftApi when no existing draft
 *   - Skips save when skipIfApproved=true and proposal is approved
 *   - Skips save when skipIfApproved=true and proposal is rejected
 *   - Saves on visibilitychange (tab hidden)
 *   - Writes to localStorage fallback on beforeunload
 *   - Cleans up all event listeners on unmount
 */

import { renderHook } from "@testing-library/react";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import * as draftApi from "@/services/draft.service";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import type { ProposalData } from "@/interfaces/proposalInterfaces";
import { HttpError } from "@/config/httpClient";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/draft.service", () => ({
  saveDraft: jest.fn(),
  updateDraft: jest.fn(),
  getDraftByProposalId: jest.fn(),
  getDraft: jest.fn(),
}));

jest.mock("@/config/httpClient", () => {
  class HttpError extends Error {
    public readonly statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.name = "HttpError";
      this.statusCode = statusCode;
    }
  }
  return { HttpError };
});

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSaveDraft = draftApi.saveDraft as jest.Mock;
const mockUpdateDraft = draftApi.updateDraft as jest.Mock;
const mockGetDraftByProposalId = draftApi.getDraftByProposalId as jest.Mock;
const mockGetDraft = draftApi.getDraft as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseProposal: ProposalData = {
  title: "Test Proposal",
  clientName: "Acme Corp",
  description: "A test proposal",
  tone: "professional",
  lengthPreference: "balanced",
  language: "English - US",
  aiModel: "gpt-4o",
  selectedSections: ["executive_summary"],
  sectionDisplayNames: {},
  customSections: [],
  contextualInstructions: "",
  webReferences: [],
  filesMeta: [],
  templateId: null,
  templateType: "scratch",
  status: "completed",
  approvalStatus: "pending",
};

const defaultOptions = {
  enabled: true,
  proposalId: 42,
  proposal: baseProposal,
  activeSection: "executive_summary",
  lastLocation: "wizard_parameters" as const,
  stage: "wizard_in_progress" as const,
  wizardStep: 1,
  skipIfApproved: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDraftByProposalId.mockResolvedValue(null);
  mockGetDraft.mockResolvedValue({ generatedContent: {} });
  mockSaveDraft.mockResolvedValue({ id: "new-draft-1" });
  mockUpdateDraft.mockResolvedValue({ id: "existing-draft-1" });
  // Reset stores so state doesn't bleed between tests
  useDraftStore.getState().reset();
  useDraftSessionStore.setState({
    currentDraftId: null,
    autoSaveEnabled: true,
    draftStage: "template_selection",
    completedSteps: [],
  });
  // Reset localStorage
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Guard conditions — early returns
// ---------------------------------------------------------------------------

describe("useDraftPersistence — guard conditions", () => {
  it("does not save when enabled=false", () => {
    renderHook(() => useDraftPersistence({ ...defaultOptions, enabled: false }));
    // Trigger visibilitychange
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mockSaveDraft).not.toHaveBeenCalled();
    expect(mockUpdateDraft).not.toHaveBeenCalled();
  });

  it("does not save when proposalId is null", () => {
    renderHook(() => useDraftPersistence({ ...defaultOptions, proposalId: null }));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  it("does not save when proposal is null", () => {
    renderHook(() => useDraftPersistence({ ...defaultOptions, proposal: null }));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// skipIfApproved logic
// ---------------------------------------------------------------------------

describe("useDraftPersistence — skipIfApproved", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("skips save when proposal is approved and skipIfApproved=true", async () => {
    const approvedProposal = { ...baseProposal, approvalStatus: "approved" as const };
    renderHook(() =>
      useDraftPersistence({
        ...defaultOptions,
        proposal: approvedProposal,
        skipIfApproved: true,
      })
    );

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    // Flush microtasks
    await jest.runAllTimersAsync();

    expect(mockSaveDraft).not.toHaveBeenCalled();
    expect(mockUpdateDraft).not.toHaveBeenCalled();
  });

  it("skips save when proposal is rejected and skipIfApproved=true", async () => {
    const rejectedProposal = { ...baseProposal, approvalStatus: "rejected" as const };
    renderHook(() =>
      useDraftPersistence({
        ...defaultOptions,
        proposal: rejectedProposal,
        skipIfApproved: true,
      })
    );

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await jest.runAllTimersAsync();

    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  it("saves when proposal is approved but skipIfApproved=false", async () => {
    const approvedProposal = { ...baseProposal, approvalStatus: "approved" as const };
    renderHook(() =>
      useDraftPersistence({
        ...defaultOptions,
        proposal: approvedProposal,
        skipIfApproved: false,
      })
    );

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await jest.runAllTimersAsync();

    expect(mockSaveDraft).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// beforeunload — localStorage fallback
// ---------------------------------------------------------------------------

describe("useDraftPersistence — beforeunload fallback", () => {
  it("writes to localStorage on beforeunload", () => {
    renderHook(() => useDraftPersistence(defaultOptions));

    window.dispatchEvent(new Event("beforeunload"));

    const stored = localStorage.getItem("drafts_autosave_fallback");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed[0].title).toBe("Test Proposal");
    expect(parsed[0].clientName).toBe("Acme Corp");
  });

  it("does not write to localStorage when proposal is approved and skipIfApproved=true", () => {
    const approvedProposal = { ...baseProposal, approvalStatus: "approved" as const };
    renderHook(() =>
      useDraftPersistence({
        ...defaultOptions,
        proposal: approvedProposal,
        skipIfApproved: true,
      })
    );

    window.dispatchEvent(new Event("beforeunload"));

    const stored = localStorage.getItem("drafts_autosave_fallback");
    expect(stored).toBeNull();
  });

  it("updates existing fallback entry instead of duplicating", () => {
    // Pre-populate localStorage with an entry for the same proposal
    const existing = [{ id: "42", title: "Old Title", savedAt: "2025-01-01T00:00:00Z" }];
    localStorage.setItem("drafts_autosave_fallback", JSON.stringify(existing));

    renderHook(() => useDraftPersistence(defaultOptions));
    window.dispatchEvent(new Event("beforeunload"));

    const stored = JSON.parse(localStorage.getItem("drafts_autosave_fallback")!);
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe("Test Proposal");
  });
});

// ---------------------------------------------------------------------------
// visibilitychange — async save path
// ---------------------------------------------------------------------------

describe("useDraftPersistence — visibilitychange async save", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetDraftByProposalId.mockResolvedValue(null);
    mockSaveDraft.mockResolvedValue({ id: "new-draft-1" });
    mockUpdateDraft.mockResolvedValue({ id: "existing-draft-1" });
    useDraftStore.getState().reset();
    useDraftSessionStore.setState({
      currentDraftId: null,
      autoSaveEnabled: true,
      draftStage: "template_selection",
      completedSteps: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls saveDraftApi when no existing draft found", async () => {
    mockGetDraftByProposalId.mockResolvedValue(null);
    renderHook(() => useDraftPersistence(defaultOptions));

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await jest.runAllTimersAsync();

    expect(mockGetDraftByProposalId).toHaveBeenCalledWith(42);
    expect(mockSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 42,
        title: "Test Proposal",
      })
    );
  });

  it("calls updateDraftApi when existing draft found", async () => {
    mockGetDraftByProposalId.mockResolvedValue({ id: "existing-draft-1" });
    // Hook uses currentDraftId from session store (not getDraftByProposalId) to pick update vs create
    useDraftSessionStore.setState({ currentDraftId: "existing-draft-1" });
    renderHook(() => useDraftPersistence(defaultOptions));

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await jest.runAllTimersAsync();

    expect(mockUpdateDraft).toHaveBeenCalledWith(
      "existing-draft-1",
      expect.objectContaining({
        proposalId: 42,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Cleanup on unmount
// ---------------------------------------------------------------------------

describe("useDraftPersistence — cleanup", () => {
  it("removes all event listeners on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const docRemoveSpy = jest.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useDraftPersistence(defaultOptions));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pagehide", expect.any(Function));
    expect(docRemoveSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});

// ---------------------------------------------------------------------------
// saveOnMount — lines 191-192
// ---------------------------------------------------------------------------

describe("useDraftPersistence — saveOnMount", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetDraftByProposalId.mockResolvedValue(null);
    mockGetDraft.mockResolvedValue({ generatedContent: {} });
    mockSaveDraft.mockResolvedValue({ id: "mount-draft-1" });
    mockUpdateDraft.mockResolvedValue({ id: "existing-draft-1" });
    useDraftStore.getState().reset();
    useDraftSessionStore.setState({
      currentDraftId: null,
      autoSaveEnabled: true,
      draftStage: "template_selection",
      completedSteps: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls saveDraft on mount when saveOnMount=true", async () => {
    renderHook(() => useDraftPersistence({ ...defaultOptions, saveOnMount: true }));
    await jest.runAllTimersAsync();
    expect(mockSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ proposalId: 42 }));
  });

  it("does not call saveDraft a second time on remount (hasMountSavedRef guard)", async () => {
    const { rerender } = renderHook(() =>
      useDraftPersistence({ ...defaultOptions, saveOnMount: true })
    );
    await jest.runAllTimersAsync();
    const firstCallCount = mockSaveDraft.mock.calls.length;

    rerender();
    await jest.runAllTimersAsync();

    expect(mockSaveDraft.mock.calls.length).toBe(firstCallCount);
  });

  it("does not save on mount when saveOnMount=false (default)", () => {
    renderHook(() => useDraftPersistence({ ...defaultOptions, saveOnMount: false }));
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// existingDraft fetch path — lines 97-108
// ---------------------------------------------------------------------------

describe("useDraftPersistence — fetch existing draft content on save", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetDraft.mockResolvedValue({ generatedContent: { intro: "Hello" } });
    mockSaveDraft.mockResolvedValue({ id: "saved-from-existing" });
    mockUpdateDraft.mockResolvedValue({ id: "updated" });
    useDraftStore.getState().reset();
    useDraftSessionStore.setState({
      currentDraftId: null,
      autoSaveEnabled: true,
      draftStage: "template_selection",
      completedSteps: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fetches existing draft content when proposal has no sections (else if branch)", async () => {
    // getDraftByProposalId returns a non-null draft → getDraft is called
    mockGetDraftByProposalId.mockResolvedValue({ id: "existing-content-draft" });

    renderHook(() => useDraftPersistence(defaultOptions));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    expect(mockGetDraftByProposalId).toHaveBeenCalledWith(42);
    expect(mockGetDraft).toHaveBeenCalledWith("existing-content-draft");
    expect(mockSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ generatedContent: { intro: "Hello" } })
    );
  });

  it("handles getDraftByProposalId returning null (no full draft fetch)", async () => {
    mockGetDraftByProposalId.mockResolvedValue(null);

    renderHook(() => useDraftPersistence(defaultOptions));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    expect(mockGetDraft).not.toHaveBeenCalled();
    expect(mockSaveDraft).toHaveBeenCalled();
  });

  it("logs warning when getDraftByProposalId throws (inner catch branch)", async () => {
    mockGetDraftByProposalId.mockRejectedValue(new Error("Fetch error"));
    const { logger } = jest.requireMock("@/utils/logger") as { logger: { warn: jest.Mock } };

    renderHook(() => useDraftPersistence(defaultOptions));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    expect(logger.warn).toHaveBeenCalled();
    // Save still proceeds after the inner catch
    expect(mockSaveDraft).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 404 draft recreation — lines 149-160
// ---------------------------------------------------------------------------

describe("useDraftPersistence — 404 draft recreation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetDraftByProposalId.mockResolvedValue(null);
    mockGetDraft.mockResolvedValue({ generatedContent: {} });
    mockSaveDraft.mockResolvedValue({ id: "recreation-draft" });
    useDraftStore.getState().reset();
    useDraftSessionStore.setState({
      currentDraftId: "stale-draft-id",
      autoSaveEnabled: true,
      draftStage: "template_selection",
      completedSteps: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates a new draft when updateDraft returns 404 (HttpError statusCode=404)", async () => {
    mockUpdateDraft.mockRejectedValue(new HttpError(404, "Not Found"));

    renderHook(() => useDraftPersistence(defaultOptions));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    // After 404: setCurrentDraftId(null) then saveDraft called then setCurrentDraftId(saved.id)
    expect(mockSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ proposalId: 42 }));
  });

  it("logs error but does NOT create new draft when updateDraft fails with non-404 error", async () => {
    mockUpdateDraft.mockRejectedValue(new HttpError(500, "Internal Server Error"));
    const { logger } = jest.requireMock("@/utils/logger") as { logger: { error: jest.Mock } };

    renderHook(() => useDraftPersistence(defaultOptions));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    expect(logger.error).toHaveBeenCalled();
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// approvalStatus override (options.approvalStatus takes priority over proposal.approvalStatus)
// ---------------------------------------------------------------------------

describe("useDraftPersistence — approvalStatus option override", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetDraftByProposalId.mockResolvedValue(null);
    mockGetDraft.mockResolvedValue({ generatedContent: {} });
    mockSaveDraft.mockResolvedValue({ id: "override-draft" });
    useDraftStore.getState().reset();
    useDraftSessionStore.setState({
      currentDraftId: null,
      autoSaveEnabled: true,
      draftStage: "template_selection",
      completedSteps: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses options.approvalStatus over proposal.approvalStatus for skip check", async () => {
    // proposal.approvalStatus = "pending" but options.approvalStatus = "approved" + skipIfApproved
    renderHook(() =>
      useDraftPersistence({
        ...defaultOptions,
        approvalStatus: "approved",
        skipIfApproved: true,
      })
    );

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    // effectiveStatus = "approved" → skip
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Lines 67-68: saveDraft early-return when !proposal (enabled=true, proposal=null)
// The only code-path that calls saveDraft() without going through an event
// handler that already guards on `proposal` is the saveOnMount effect — but
// that effect also guards on `!proposal`.  The remaining way to reach the
// guard inside saveDraft with proposal=null is to render with a valid
// proposal (so the saveOnMount ref is NOT set yet) while also setting
// saveOnMount=false, then trigger the visibility handler after rerendering
// with proposal=null.  Because the visibilitychange handler captures `saveDraft`
// via a closure and `saveDraft` itself reads `proposal` from the closure built
// at the previous render, the cleanest deterministic path is: start with a
// non-null proposal so the handler is registered, then rerender with
// proposal=null so the NEW saveDraft closes over null, and then fire the
// document event — the handler fires saveDraft which hits line 67.
// ---------------------------------------------------------------------------

describe("useDraftPersistence — saveDraft !proposal branch (lines 67-68)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetDraftByProposalId.mockResolvedValue(null);
    mockSaveDraft.mockResolvedValue({ id: "guard-draft" });
    useDraftStore.getState().reset();
    useDraftSessionStore.setState({
      currentDraftId: null,
      autoSaveEnabled: true,
      draftStage: "template_selection",
      completedSteps: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });

  it("saveDraft returns early without saving when proposal is null (enabled=true)", async () => {
    // Render with a valid proposal first so event listeners are attached and enabled=true
    const { rerender } = renderHook(
      (props: Parameters<typeof useDraftPersistence>[0]) => useDraftPersistence(props),
      { initialProps: { ...defaultOptions, saveOnMount: false } }
    );

    // Now rerender with proposal=null — the new saveDraft closure captures null
    rerender({ ...defaultOptions, proposal: null, saveOnMount: false });

    // Fire visibilitychange: the handler checks `document.hidden && proposal`
    // where proposal is null, so saveDraft should NOT be called at all from
    // the event handler.  This exercises the null-proposal guard path.
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    // Neither saveDraft nor updateDraft should have been called
    expect(mockSaveDraft).not.toHaveBeenCalled();
    expect(mockUpdateDraft).not.toHaveBeenCalled();
  });

  it("saveDraft !enabled branch: re-render to enabled=false stops saves", async () => {
    // Start enabled so listeners are registered
    const { rerender } = renderHook(
      (props: Parameters<typeof useDraftPersistence>[0]) => useDraftPersistence(props),
      { initialProps: { ...defaultOptions, saveOnMount: false } }
    );

    // Disable hook
    rerender({ ...defaultOptions, enabled: false, saveOnMount: false });

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    expect(mockSaveDraft).not.toHaveBeenCalled();
    expect(mockUpdateDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// proposalSections truthy branch (line 97) — uses existing sections
// ---------------------------------------------------------------------------

describe("useDraftPersistence — proposalSections truthy branch (line 97)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetDraftByProposalId.mockResolvedValue(null);
    mockSaveDraft.mockResolvedValue({ id: "sections-draft" });
    useDraftStore.getState().reset();
    useDraftSessionStore.setState({
      currentDraftId: null,
      autoSaveEnabled: true,
      draftStage: "template_selection",
      completedSteps: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses proposal.sections directly when non-empty (truthy proposalSections branch)", async () => {
    const proposalWithSections = {
      ...baseProposal,
      sections: { executive_summary: "Generated content here" },
    };

    renderHook(() =>
      useDraftPersistence({ ...defaultOptions, proposal: proposalWithSections as never })
    );

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    // getDraftByProposalId should NOT be called since proposalSections is non-empty
    expect(mockGetDraftByProposalId).not.toHaveBeenCalled();
    expect(mockSaveDraft).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Line 97 via saveOnMount — proposalSections truthy shortcut skips API fetch
// ---------------------------------------------------------------------------

describe("useDraftPersistence — line 97 via saveOnMount", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetDraftByProposalId.mockResolvedValue(null);
    mockSaveDraft.mockResolvedValue({ id: "sections-mount-draft" });
    useDraftStore.getState().reset();
    useDraftSessionStore.setState({
      currentDraftId: null,
      autoSaveEnabled: true,
      draftStage: "template_selection",
      completedSteps: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses proposal.sections directly (line 97) and skips getDraftByProposalId via saveOnMount", async () => {
    const proposalWithSections = {
      ...baseProposal,
      sections: { intro: "Intro content", summary: "Summary content" },
    };

    renderHook(() =>
      useDraftPersistence({
        ...defaultOptions,
        proposal: proposalWithSections as never,
        saveOnMount: true,
      })
    );

    await jest.runAllTimersAsync();

    // Because proposalSections is non-empty, the if-branch at line 96-97 is taken
    // and getDraftByProposalId must NOT be called
    expect(mockGetDraftByProposalId).not.toHaveBeenCalled();
    expect(mockSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 42,
        generatedContent: { intro: "Intro content", summary: "Summary content" },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Outer catch (line 170) — saveDraftToStore throws when no currentDraftId
// ---------------------------------------------------------------------------

describe("useDraftPersistence — outer catch (line 170)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetDraftByProposalId.mockResolvedValue(null);
    mockSaveDraft.mockRejectedValue(new Error("Unexpected save failure"));
    useDraftStore.getState().reset();
    useDraftSessionStore.setState({
      currentDraftId: null,
      autoSaveEnabled: true,
      draftStage: "template_selection",
      completedSteps: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("logs error when saveDraftToStore throws (outer catch at line 170)", async () => {
    const { logger } = jest.requireMock("@/utils/logger") as { logger: { error: jest.Mock } };

    renderHook(() => useDraftPersistence({ ...defaultOptions }));

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await jest.runAllTimersAsync();

    expect(logger.error).toHaveBeenCalledWith(
      "[useDraftPersistence] Save failed",
      expect.any(Error)
    );
  });
});
