/**
 * Tests for useDraftRecovery hook
 *
 * Coverage targets:
 *   - Loads available drafts on mount
 *   - recoverDraft restores proposal data, steps, and stage
 *   - recoverDraft navigates to correct route based on lastLocation
 *   - recoverDraft sets generatedProposalId when proposalId exists
 *   - recoverDraft scrolls to saved position
 *   - Auto-recover picks the most recently updated draft
 *   - Auto-recover only fires once
 *   - Handles API errors gracefully
 */

import { renderHook, act } from "@testing-library/react";
import { useDraftRecovery } from "@/hooks/useDraftRecovery";
import * as draftApi from "@/services/draft.service";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import type { SavedDraft, DraftMetadata } from "@/interfaces/draftInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/draft.service", () => ({
  getDraft: jest.fn(),
  listDrafts: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock Zustand wizard store with controlled actions
const mockUpdateProposalData = jest.fn();
const mockSetCurrentStep = jest.fn();
const mockSetMaxStepReached = jest.fn();
const mockSetGeneratedProposalId = jest.fn();

jest.mock("@/store/features/wizard/proposalWizardSlice", () => ({
  useWizardActions: () => ({
    updateProposalData: mockUpdateProposalData,
    setCurrentStep: mockSetCurrentStep,
    setMaxStepReached: mockSetMaxStepReached,
    setGeneratedProposalId: mockSetGeneratedProposalId,
  }),
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetDraft = draftApi.getDraft as jest.Mock;
const mockListDrafts = draftApi.listDrafts as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const draftMetadata: DraftMetadata = {
  id: "draft-1",
  proposalId: 42,
  title: "Test Proposal",
  clientName: "Acme Corp",
  status: "draft",
  lastLocation: "wizard_parameters",
  stage: "wizard_in_progress",
  updatedAt: "2025-01-02T10:00:00Z",
};

const savedDraft: SavedDraft = {
  id: "draft-1",
  proposalId: 42,
  title: "Test Proposal",
  clientName: "Acme Corp",
  status: "draft",
  lastLocation: "wizard_parameters",
  stage: "wizard_in_progress",
  wizardState: {
    proposalData: {
      title: "Test Proposal",
      clientName: "Acme Corp",
      description: "A test",
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
    } as never,
    currentStep: 2,
    maxStepReached: 3,
    completedSteps: [1, 2],
  },
  generatedContent: {},
  uiState: {
    scrollPosition: 500,
    activeSection: "executive_summary",
    expandedSections: [],
    lastVisibleSection: null,
  },
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-02T10:00:00Z",
  version: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListDrafts.mockResolvedValue([draftMetadata]);
  mockGetDraft.mockResolvedValue(savedDraft);
  // Reset draft session store
  useDraftSessionStore.setState({
    currentDraftId: null,
    autoSaveEnabled: true,
    draftStage: "template_selection",
    completedSteps: [],
  });
  // Mock window.scrollTo
  window.scrollTo = jest.fn();
});

// ---------------------------------------------------------------------------
// Load available drafts on mount
// ---------------------------------------------------------------------------

describe("useDraftRecovery — load available drafts", () => {
  it("calls useDraftStore.fetchDrafts on mount", async () => {
    renderHook(() => useDraftRecovery());

    // fetchDrafts is called via useDraftStore
    expect(mockListDrafts).toHaveBeenCalledTimes(1);
  });

  it("populates availableDrafts from useDraftStore after fetch", async () => {
    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.availableDrafts).toEqual([draftMetadata]);
    expect(result.current.isLoadingDrafts).toBe(false);
  });

  it("sets recoveryError when fetchDrafts fails", async () => {
    mockListDrafts.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.recoveryError).not.toBeNull();
    expect(result.current.recoveryError?.message).toBe("Network error");
  });
});

// ---------------------------------------------------------------------------
// recoverDraft — state restoration
// ---------------------------------------------------------------------------

describe("useDraftRecovery — recoverDraft state restoration", () => {
  it("calls updateProposalData with draft wizard state proposalData", async () => {
    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockUpdateProposalData).toHaveBeenCalledWith(
      savedDraft.wizardState.proposalData
    );
  });

  it("calls setCurrentStep with draft currentStep", async () => {
    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockSetCurrentStep).toHaveBeenCalledWith(2);
  });

  it("calls setMaxStepReached with draft maxStepReached", async () => {
    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockSetMaxStepReached).toHaveBeenCalledWith(3);
  });

  it("sets completedSteps in draft session store", async () => {
    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(useDraftSessionStore.getState().completedSteps).toEqual([1, 2]);
  });

  it("sets draftStage in draft session store", async () => {
    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(useDraftSessionStore.getState().draftStage).toBe("wizard_in_progress");
  });

  it("sets generatedProposalId when draft has proposalId", async () => {
    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockSetGeneratedProposalId).toHaveBeenCalledWith(42);
  });

  it("does not set generatedProposalId when draft has null proposalId", async () => {
    mockGetDraft.mockResolvedValue({ ...savedDraft, proposalId: null });

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockSetGeneratedProposalId).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// recoverDraft — navigation based on lastLocation
// ---------------------------------------------------------------------------

describe("useDraftRecovery — navigation by lastLocation", () => {
  it("navigates to /parameters for wizard_parameters", async () => {
    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/parameters");
  });

  it("navigates to /review for wizard_review", async () => {
    mockGetDraft.mockResolvedValue({ ...savedDraft, lastLocation: "wizard_review" });

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/review");
  });

  it("navigates to /proposal/:id for web_view with proposalId", async () => {
    mockGetDraft.mockResolvedValue({ ...savedDraft, lastLocation: "web_view" });

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/proposal/42");
  });

  it("navigates to /parameters for web_view without proposalId", async () => {
    mockGetDraft.mockResolvedValue({
      ...savedDraft,
      lastLocation: "web_view",
      proposalId: null,
    });

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/parameters");
  });

  it("navigates to /generating for ai_sections", async () => {
    mockGetDraft.mockResolvedValue({ ...savedDraft, lastLocation: "ai_sections" });

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/generating");
  });

  it("defaults to /parameters for unknown lastLocation", async () => {
    mockGetDraft.mockResolvedValue({
      ...savedDraft,
      lastLocation: "unknown_location" as never,
    });

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(mockPush).toHaveBeenCalledWith("/parameters");
  });
});

// ---------------------------------------------------------------------------
// recoverDraft — scroll restoration
// ---------------------------------------------------------------------------

describe("useDraftRecovery — scroll restoration", () => {
  it("scrolls to saved position when scrollPosition > 0", async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    // The scroll happens after a 300ms setTimeout
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 500,
      behavior: "smooth",
    });

    jest.useRealTimers();
  });

  it("does not scroll when scrollPosition is 0", async () => {
    mockGetDraft.mockResolvedValue({
      ...savedDraft,
      uiState: { ...savedDraft.uiState, scrollPosition: 0 },
    });

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Auto-recover
// ---------------------------------------------------------------------------

describe("useDraftRecovery — autoRecover", () => {
  it("auto-recovers the most recently updated draft", async () => {
    const olderDraft: DraftMetadata = {
      ...draftMetadata,
      id: "draft-old",
      updatedAt: "2025-01-01T00:00:00Z",
    };
    const newerDraft: DraftMetadata = {
      ...draftMetadata,
      id: "draft-new",
      updatedAt: "2025-01-03T00:00:00Z",
    };

    mockListDrafts.mockResolvedValue([olderDraft, newerDraft]);

    const onRecoveryComplete = jest.fn();

    renderHook(() => useDraftRecovery({
      autoRecover: true,
      onRecoveryComplete,
    }));

    // Wait for listDrafts + auto-recover
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Should recover the newer draft (draft-new)
    expect(mockGetDraft).toHaveBeenCalledWith("draft-new");
  });

  it("auto-recovers only once even if component re-renders", async () => {
    mockListDrafts.mockResolvedValue([draftMetadata]);

    const { rerender } = renderHook(() => useDraftRecovery({ autoRecover: true }));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const callCount = mockGetDraft.mock.calls.length;

    // Rerender should not trigger another recovery
    rerender({ autoRecover: true });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetDraft.mock.calls.length).toBe(callCount);
  });

  it("does not auto-recover when no drafts available", async () => {
    mockListDrafts.mockResolvedValue([]);

    renderHook(() => useDraftRecovery({ autoRecover: true }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("useDraftRecovery — error handling", () => {
  it("sets recoveryError when getDraft fails", async () => {
    mockGetDraft.mockRejectedValue(new Error("Server error"));

    const onRecoveryError = jest.fn();
    const { result } = renderHook(() => useDraftRecovery({ onRecoveryError }));

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(result.current.recoveryError).not.toBeNull();
    expect(result.current.recoveryError?.message).toBe("Server error");
    expect(onRecoveryError).toHaveBeenCalled();
    expect(result.current.isRecovering).toBe(false);
  });

  it("wraps non-Error rejections in Error", async () => {
    mockGetDraft.mockRejectedValue("string error");

    const { result } = renderHook(() => useDraftRecovery());

    await act(async () => {
      await result.current.recoverDraft("draft-1");
    });

    expect(result.current.recoveryError).toBeInstanceOf(Error);
    expect(result.current.recoveryError?.message).toBe("Failed to recover draft");
  });
});
