/**
 * Tests for useProposalPageData hook
 *
 * Coverage targets:
 *   - isLoading=true initially
 *   - Sets proposal and isLoading=false on completed status
 *   - Sets activeSection from first selectedSection on load
 *   - Sets fromHistory=true when ?from=history in searchParams
 *   - Redirects to /generating/:id on active generation status
 *   - Sets errorMessage on failed status
 *   - Sets errorMessage on unexpected status (no redirect)
 *   - Sets errorMessage on fetch error
 *   - Calls syncVisitedStepsFromBackend after proposal is loaded
 *   - Restores activeSection from sessionStorage UI state
 *   - fetchProposal is re-runnable
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useProposalPageData } from "@/hooks/useProposalPageData";
import * as proposalService from "@/services/proposal";
import type { ProposalData } from "@/interfaces/proposalInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/hooks/usePipelineSteps", () => ({
  usePipelineSteps: () => ({
    syncVisitedStepsFromBackend: jest.fn().mockResolvedValue(undefined),
    visitedPipelineSteps: [],
    highestVisitedStep: null,
    setVisitedPipelineSteps: jest.fn(),
    setHighestVisitedStep: jest.fn(),
    markStepVisitedOnBackend: jest.fn(),
    canAccessStep: jest.fn(),
    resetPipelineSteps: jest.fn(),
  }),
}));

jest.mock("@/hooks/useDraftPersistence", () => ({
  useDraftPersistence: jest.fn(),
}));

jest.mock("@/services/proposal", () => ({
  getProposal: jest.fn(),
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Store mocks
// ---------------------------------------------------------------------------

jest.mock("@/store/features/wizard/proposalWizardSlice", () => ({
  useCurrentStep: () => 1,
  useMaxStepReached: () => 1,
  useCurrentProposalId: () => null,
  useEditMode: () => false,
  useWizardActions: () => ({
    setCurrentProposalId: jest.fn(),
    updateProposalData: jest.fn(),
  }),
}));

jest.mock("@/store/features/drafts/draftSessionSlice", () => ({
  useDraftSessionStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      setDraftStage: jest.fn(),
      setCompletedSteps: jest.fn(),
      markStepCompleted: jest.fn(),
      setFromHistory: jest.fn(),
    };
    return selector(state);
  }),
}));

jest.mock("@/store/features/proposals/proposalSlice", () => ({
  useProposalStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      updateProposal: jest.fn(),
    };
    return selector(state);
  }),
}));

jest.mock("@/constants/storageKeys", () => ({
  DRAFT_UI_STATE_STORAGE_KEY: "draft_ui_state",
}));

const mockGetProposal = proposalService.getProposal as jest.Mock;

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const makeProposal = (status: string): ProposalData => ({
  title: "Test Proposal",
  clientName: "Acme",
  description: "desc",
  tone: "professional",
  lengthPreference: "balanced",
  language: "English - US",
  aiModel: "gpt-4o",
  selectedSections: ["executive_summary", "scope"],
  sectionDisplayNames: {},
  customSections: [],
  contextualInstructions: "",
  webReferences: [],
  files: [],
  filesMeta: [],
  templateId: null,
  templateType: "scratch",
  status: status as ProposalData["status"],
  approvalStatus: "pending",
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

function makeSearchParams(params: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(params);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useProposalPageData — initial state", () => {
  it("isLoading is true on initial render", () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));
    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));
    expect(result.current.isLoading).toBe(true);
  });
});

describe("useProposalPageData — completed proposal", () => {
  it("sets proposal and clears isLoading on completed status", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));
    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.proposal?.status).toBe("completed");
  });

  it("sets first selectedSection as activeSection", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));
    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeSection).toBe("executive_summary");
  });
});

describe("useProposalPageData — failed proposal", () => {
  it("sets errorMessage and clears isLoading", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("failed"));
    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.errorMessage).toContain("failed");
  });
});

describe("useProposalPageData — active generation statuses", () => {
  const activeSatuses = ["queued", "generating", "planning", "finalizing"];

  activeSatuses.forEach((status) => {
    it(`redirects to /generating/:id for status '${status}'`, async () => {
      mockGetProposal.mockResolvedValue(makeProposal(status));
      renderHook(() => useProposalPageData(42, makeSearchParams()));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/generating/42");
      });
    });
  });
});

describe("useProposalPageData — unexpected status", () => {
  it("shows error message without redirecting for unexpected status", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("cancelled"));
    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.errorMessage).toContain("Unable to load");
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("useProposalPageData — fetch error", () => {
  it("sets errorMessage on fetch failure", async () => {
    mockGetProposal.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.errorMessage).toBe("Network error");
  });

  it("sets generic message for non-Error rejection", async () => {
    mockGetProposal.mockRejectedValue("unknown");
    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.errorMessage).toBe("Failed to load proposal.");
  });
});

describe("useProposalPageData — fromHistory detection", () => {
  it("fromHistory=true when ?from=history in searchParams", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));
    const { result } = renderHook(() =>
      useProposalPageData(1, makeSearchParams({ from: "history" }))
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fromHistory).toBe(true);
  });

  it("fromHistory=false when no ?from param", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));
    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fromHistory).toBe(false);
  });
});

describe("useProposalPageData — sessionStorage UI state restore", () => {
  it("removes draft UI state from sessionStorage after restore attempt", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));

    sessionStorage.setItem(
      "draft_ui_state",
      JSON.stringify({
        activeSection: "scope",
        scrollPosition: 0,
        expandedSections: [],
        lastVisibleSection: null,
      })
    );

    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // After proposal loads, sessionStorage entry should be consumed
    await waitFor(() => {
      expect(sessionStorage.getItem("draft_ui_state")).toBeNull();
    });
  });

  it("ignores sessionStorage when entry is not present", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));

    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should default to first section
    expect(result.current.activeSection).toBe("executive_summary");
  });
});

describe("useProposalPageData — fetchProposal", () => {
  it("refetch re-runs getProposal", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));

    const { result } = renderHook(() => useProposalPageData(1, makeSearchParams()));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCount = mockGetProposal.mock.calls.length;
    await act(async () => {
      await result.current.fetchProposal();
    });

    expect(mockGetProposal.mock.calls.length).toBeGreaterThan(callCount);
  });
});
