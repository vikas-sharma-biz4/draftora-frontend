/**
 * Tests for useProposals hook
 *
 * Coverage targets:
 *   - Returns proposals from store
 *   - Calls fetchProposals on mount when autoFetch=true and filter='all'
 *   - Calls fetchProposalHistory on mount when filter='history'
 *   - Does not fetch when autoFetch=false
 *   - Filters: 'approved' returns only approved history proposals
 *   - Filters: 'rejected' returns only rejected history proposals
 *   - Filters: 'pending' returns only pending proposals
 *   - refetch calls fetchProposals(true) for non-history filter
 *   - refetch calls fetchProposalHistory(true) for history filter
 *   - fetchMore delegates to fetchMoreProposals
 */

import { renderHook, act } from "@testing-library/react";
import { useProposals } from "@/hooks/useProposals";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/hooks/usePageVisibility", () => ({
  usePageVisibility: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeProposal = (
  id: number,
  approvalStatus: "pending" | "approved" | "rejected"
): ProposalListItem => ({
  id,
  title: `Proposal ${id}`,
  clientName: "Client",
  status: "completed",
  approvalStatus,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const pendingProposals = [makeProposal(1, "pending"), makeProposal(2, "pending")];
const historyApproved = [makeProposal(3, "approved"), makeProposal(4, "approved")];
const historyRejected = [makeProposal(5, "rejected")];
const allHistory = [...historyApproved, ...historyRejected];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockFetchProposals: jest.Mock;
let mockFetchProposalHistory: jest.Mock;
let mockFetchMoreProposals: jest.Mock;
let mockGetProposalById: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();

  mockFetchProposals = jest.fn().mockResolvedValue(undefined);
  mockFetchProposalHistory = jest.fn().mockResolvedValue(undefined);
  mockFetchMoreProposals = jest.fn().mockResolvedValue(undefined);
  mockGetProposalById = jest.fn();

  useProposalStore.setState({
    proposals: pendingProposals,
    historyProposals: allHistory,
    isLoading: false,
    isLoadingMore: false,
    isInitialized: true,
    error: null,
    hasMore: false,
    fetchProposals: mockFetchProposals,
    fetchProposalHistory: mockFetchProposalHistory,
    fetchMoreProposals: mockFetchMoreProposals,
    getProposalById: mockGetProposalById,
  } as Parameters<typeof useProposalStore.setState>[0]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useProposals — autoFetch", () => {
  it("calls fetchProposals on mount when autoFetch=true and filter='all'", () => {
    renderHook(() => useProposals({ autoFetch: true, filter: "all" }));
    expect(mockFetchProposals).toHaveBeenCalledTimes(1);
  });

  it("calls fetchProposalHistory on mount when filter='history'", () => {
    renderHook(() => useProposals({ autoFetch: true, filter: "history" }));
    expect(mockFetchProposalHistory).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when autoFetch=false", () => {
    renderHook(() => useProposals({ autoFetch: false }));
    expect(mockFetchProposals).not.toHaveBeenCalled();
    expect(mockFetchProposalHistory).not.toHaveBeenCalled();
  });
});

describe("useProposals — filtering", () => {
  it("returns all proposals when filter='all'", () => {
    const { result } = renderHook(() => useProposals({ autoFetch: false, filter: "all" }));
    expect(result.current.proposals).toEqual(pendingProposals);
  });

  it("returns historyProposals when filter='history'", () => {
    const { result } = renderHook(() => useProposals({ autoFetch: false, filter: "history" }));
    expect(result.current.proposals).toEqual(allHistory);
  });

  it("returns only approved proposals when filter='approved'", () => {
    const { result } = renderHook(() => useProposals({ autoFetch: false, filter: "approved" }));
    expect(result.current.proposals).toEqual(historyApproved);
    result.current.proposals.forEach((p) => expect(p.approvalStatus).toBe("approved"));
  });

  it("returns only rejected proposals when filter='rejected'", () => {
    const { result } = renderHook(() => useProposals({ autoFetch: false, filter: "rejected" }));
    expect(result.current.proposals).toEqual(historyRejected);
  });

  it("returns pending proposals when filter='pending'", () => {
    const { result } = renderHook(() => useProposals({ autoFetch: false, filter: "pending" }));
    result.current.proposals.forEach((p) => expect(p.approvalStatus).toBe("pending"));
  });
});

describe("useProposals — refetch", () => {
  it("calls fetchProposals(true) for non-history filter", async () => {
    const { result } = renderHook(() => useProposals({ filter: "all" }));

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockFetchProposals).toHaveBeenCalledWith(true);
  });

  it("calls fetchProposalHistory(true) for history filter", async () => {
    const { result } = renderHook(() => useProposals({ filter: "history" }));

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockFetchProposalHistory).toHaveBeenCalledWith(true);
  });
});

describe("useProposals — fetchMore", () => {
  it("delegates to fetchMoreProposals", async () => {
    const { result } = renderHook(() => useProposals());

    await act(async () => {
      await result.current.fetchMore();
    });

    expect(mockFetchMoreProposals).toHaveBeenCalledTimes(1);
  });
});

describe("useProposals — store state pass-through", () => {
  it("exposes isLoading, isInitialized, error, hasMore", () => {
    useProposalStore.setState({
      isLoading: true,
      isInitialized: false,
      error: "some error",
      hasMore: true,
    } as Parameters<typeof useProposalStore.setState>[0]);

    const { result } = renderHook(() => useProposals({ autoFetch: false }));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isInitialized).toBe(false);
    expect(result.current.error).toBe("some error");
    expect(result.current.hasMore).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// usePageVisibility callback — branch coverage (lines 58-63)
// ---------------------------------------------------------------------------

import { usePageVisibility } from "@/hooks/usePageVisibility";

const mockUsePageVisibility = usePageVisibility as jest.Mock;

describe("useProposals — usePageVisibility callback branches", () => {
  it("calls fetchProposalHistory when callback fires with filter='history'", () => {
    renderHook(() => useProposals({ autoFetch: true, filter: "history" }));
    const cb: () => void = mockUsePageVisibility.mock.calls[0][0];
    jest.clearAllMocks();
    act(() => cb());
    expect(mockFetchProposalHistory).toHaveBeenCalledTimes(1);
    expect(mockFetchProposals).not.toHaveBeenCalled();
  });

  it("calls fetchProposals when callback fires with filter='all'", () => {
    renderHook(() => useProposals({ autoFetch: true, filter: "all" }));
    const cb: () => void = mockUsePageVisibility.mock.calls[0][0];
    jest.clearAllMocks();
    act(() => cb());
    expect(mockFetchProposals).toHaveBeenCalledTimes(1);
    expect(mockFetchProposalHistory).not.toHaveBeenCalled();
  });

  it("returns early when autoFetch=false and callback fires", () => {
    renderHook(() => useProposals({ autoFetch: false, filter: "history" }));
    const cb: () => void = mockUsePageVisibility.mock.calls[0][0];
    jest.clearAllMocks();
    act(() => cb());
    expect(mockFetchProposalHistory).not.toHaveBeenCalled();
    expect(mockFetchProposals).not.toHaveBeenCalled();
  });
});
