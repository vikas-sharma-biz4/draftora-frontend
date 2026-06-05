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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/draft.service", () => ({
  saveDraft: jest.fn(),
  updateDraft: jest.fn(),
  getDraftByProposalId: jest.fn(),
}));

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
  files: [],
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
