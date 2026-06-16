/**
 * Tests for useProposalOutput hook
 *
 * Coverage targets:
 *   - isLoading=true initially
 *   - Sets proposal and isLoading=false on completed status
 *   - Sets first selectedSection as activeSection on load
 *   - Calls onProposalLoaded callback when completed
 *   - Sets errorMessage and isLoading=false on failed status
 *   - Redirects to /generating/:id when proposal is still generating
 *   - Sets errorMessage on fetch error
 *   - setActiveSection updates activeSection state
 *   - refetch re-runs fetchProposal
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useProposalOutput } from "@/hooks/useProposalOutput";
import * as proposalService from "@/services/proposal";
import type { ProposalData } from "@/interfaces/proposalInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => {
  const replaceFn = jest.fn();
  return {
    useRouter: () => ({ replace: replaceFn }),
  };
});

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

const mockGetProposal = proposalService.getProposal as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
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
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useProposalOutput — initial state", () => {
  it("isLoading is true on initial render", () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));

    const { result } = renderHook(() => useProposalOutput({ proposalId: 1 }));

    expect(result.current.isLoading).toBe(true);
  });
});

describe("useProposalOutput — completed proposal", () => {
  it("sets proposal and isLoading=false when status is completed", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));

    const { result } = renderHook(() => useProposalOutput({ proposalId: 1 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.proposal).not.toBeNull();
    expect(result.current.proposal?.status).toBe("completed");
  });

  it("sets first selectedSection as activeSection", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));

    const { result } = renderHook(() => useProposalOutput({ proposalId: 1 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeSection).toBe("executive_summary");
  });

  it("calls onProposalLoaded callback with proposal data", async () => {
    const onProposalLoaded = jest.fn();
    const proposal = makeProposal("completed");
    mockGetProposal.mockResolvedValue(proposal);

    const { result } = renderHook(() => useProposalOutput({ proposalId: 1, onProposalLoaded }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(onProposalLoaded).toHaveBeenCalledWith(proposal);
  });
});

describe("useProposalOutput — failed proposal", () => {
  it("sets errorMessage and isLoading=false when status is failed", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("failed"));

    const { result } = renderHook(() => useProposalOutput({ proposalId: 1 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.errorMessage).toContain("failed");
    expect(result.current.proposal?.status).toBe("failed");
  });
});

describe("useProposalOutput — generating proposal", () => {
  it("redirects to /generating/:id when status is generating", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("generating"));
    const navModule = jest.requireMock("next/navigation") as {
      useRouter: () => { replace: jest.Mock };
    };
    const replaceMock = navModule.useRouter().replace;

    renderHook(() => useProposalOutput({ proposalId: 42 }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/generating/42");
    });
  });
});

describe("useProposalOutput — fetch error", () => {
  it("sets errorMessage on fetch failure", async () => {
    mockGetProposal.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() => useProposalOutput({ proposalId: 1 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.errorMessage).toBe("Not found");
  });

  it("sets generic error for non-Error rejection", async () => {
    mockGetProposal.mockRejectedValue("unknown");

    const { result } = renderHook(() => useProposalOutput({ proposalId: 1 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.errorMessage).toBe("Failed to load proposal.");
  });
});

describe("useProposalOutput — setActiveSection", () => {
  it("updates activeSection state", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));

    const { result } = renderHook(() => useProposalOutput({ proposalId: 1 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setActiveSection("scope");
    });

    expect(result.current.activeSection).toBe("scope");
  });
});

describe("useProposalOutput — refetch", () => {
  it("re-runs fetchProposal on refetch call", async () => {
    mockGetProposal.mockResolvedValue(makeProposal("completed"));

    const { result } = renderHook(() => useProposalOutput({ proposalId: 1 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callCount = mockGetProposal.mock.calls.length;

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGetProposal.mock.calls.length).toBeGreaterThan(callCount);
  });
});
