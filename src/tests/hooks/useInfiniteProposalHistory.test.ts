/**
 * Tests for useInfiniteProposalHistory hook
 *
 * Coverage targets:
 *   - Fetches initial page on mount
 *   - Sets isLoading=true during fetch, false after
 *   - Populates proposals array from response
 *   - Sets hasMore based on response
 *   - Sets error on fetch failure
 *   - loadMore appends proposals to existing list
 *   - loadMore is a no-op when hasMore=false
 *   - loadMore is a no-op when already loading more
 *   - loadMore is a no-op when nextPage exceeds totalPages
 *   - refetch resets to page 1 and re-fetches
 *   - observerRef disconnects and re-creates IntersectionObserver
 *   - Cleans up observer on unmount
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useInfiniteProposalHistory } from "@/hooks/useInfiniteProposalHistory";
import * as proposalApi from "@/services/proposal";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/proposal", () => ({
  listProposalHistory: jest.fn(),
}));

// Capture the page-visibility callback so tests can trigger it manually
let capturedVisibilityCallback: (() => void) | null = null;
jest.mock("@/hooks/usePageVisibility", () => ({
  usePageVisibility: jest.fn((cb: () => void) => {
    capturedVisibilityCallback = cb;
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

const mockListProposalHistory = proposalApi.listProposalHistory as jest.Mock;

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------

const mockDisconnect = jest.fn();
const mockObserve = jest.fn();

// Expose last created instance so tests can fire the IntersectionObserver callback
let lastObserverInstance: MockIntersectionObserver | null = null;

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    lastObserverInstance = this;
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = jest.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeProposal = (id: number): ProposalListItem => ({
  id,
  title: `Proposal ${id}`,
  clientName: "Client",
  status: "completed",
  approvalStatus: "approved",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const makePage = (page: number, total: number, perPage = 20) => {
  const items = Array.from({ length: Math.min(perPage, total - (page - 1) * perPage) }, (_, i) =>
    makeProposal((page - 1) * perPage + i + 1)
  );
  const totalPages = Math.ceil(total / perPage);
  return {
    items,
    total,
    totalPages,
    hasMore: page < totalPages,
    page,
    perPage,
  };
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockDisconnect.mockClear();
  mockObserve.mockClear();
  lastObserverInstance = null;
  capturedVisibilityCallback = null;
  mockListProposalHistory.mockResolvedValue(makePage(1, 25));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useInfiniteProposalHistory — initial load", () => {
  it("fetches initial page on mount", async () => {
    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockListProposalHistory).toHaveBeenCalledWith(1, 20);
    expect(result.current.proposals).toHaveLength(20);
  });

  it("sets hasMore=true when more pages exist", async () => {
    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);
  });

  it("sets hasMore=false when only one page", async () => {
    mockListProposalHistory.mockResolvedValue(makePage(1, 5));

    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(false);
  });

  it("sets error on fetch failure", async () => {
    mockListProposalHistory.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Server error");
    expect(result.current.proposals).toHaveLength(0);
  });

  it("sets generic error message for non-Error rejection", async () => {
    mockListProposalHistory.mockRejectedValue("unknown");

    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Failed to load proposal history");
  });
});

describe("useInfiniteProposalHistory — loadMore", () => {
  it("appends proposals from next page", async () => {
    mockListProposalHistory
      .mockResolvedValueOnce(makePage(1, 25))
      .mockResolvedValueOnce(makePage(2, 25));

    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.proposals).toHaveLength(20);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.proposals).toHaveLength(25);
    expect(mockListProposalHistory).toHaveBeenCalledWith(2, 20);
  });

  it("is a no-op when hasMore=false", async () => {
    mockListProposalHistory.mockResolvedValue(makePage(1, 5));

    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCount = mockListProposalHistory.mock.calls.length;
    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockListProposalHistory.mock.calls.length).toBe(callCount);
  });

  it("sets error message when loadMore fails", async () => {
    mockListProposalHistory
      .mockResolvedValueOnce(makePage(1, 25))
      .mockRejectedValueOnce(new Error("Load more failed"));

    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBe("Load more failed");
    expect(result.current.isLoadingMore).toBe(false);
  });
});

describe("useInfiniteProposalHistory — refetch", () => {
  it("resets to page 1 and re-fetches", async () => {
    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockListProposalHistory.mockResolvedValue(makePage(1, 3));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.proposals).toHaveLength(3);
  });
});

describe("useInfiniteProposalHistory — observerRef", () => {
  it("does not create observer while loading", async () => {
    const { result } = renderHook(() => useInfiniteProposalHistory());

    // While still loading, call observerRef with a node
    const node = document.createElement("div");
    act(() => {
      result.current.observerRef(node);
    });

    // Should not observe yet because isLoading is true
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it("cleans up observer on unmount", async () => {
    mockListProposalHistory.mockResolvedValue(makePage(1, 25));
    const { result, unmount } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Set up an observer by calling observerRef with a real node
    const node = document.createElement("div");
    act(() => {
      result.current.observerRef(node);
    });

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("observes node when not loading and hasMore=true", async () => {
    mockListProposalHistory.mockResolvedValue(makePage(1, 25));
    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const node = document.createElement("div");
    act(() => {
      result.current.observerRef(node);
    });

    expect(mockObserve).toHaveBeenCalledWith(node);
  });

  it("disconnects existing observer when observerRef is called a second time", async () => {
    mockListProposalHistory.mockResolvedValue(makePage(1, 25));
    const { result } = renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const node = document.createElement("div");
    // First call creates the observer
    act(() => {
      result.current.observerRef(node);
    });
    mockDisconnect.mockClear();

    // Second call should disconnect the existing one first
    act(() => {
      result.current.observerRef(node);
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("fires loadMore when IntersectionObserver entry isIntersecting=true", async () => {
    mockListProposalHistory
      .mockResolvedValueOnce(makePage(1, 25))
      .mockResolvedValueOnce(makePage(2, 25));

    const { result } = renderHook(() => useInfiniteProposalHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const node = document.createElement("div");
    act(() => {
      result.current.observerRef(node);
    });

    expect(lastObserverInstance).not.toBeNull();

    await act(async () => {
      lastObserverInstance!.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockListProposalHistory).toHaveBeenCalledWith(2, 20);
  });

  it("does not fire loadMore when IntersectionObserver entry isIntersecting=false", async () => {
    mockListProposalHistory.mockResolvedValue(makePage(1, 25));

    const { result } = renderHook(() => useInfiniteProposalHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const node = document.createElement("div");
    act(() => {
      result.current.observerRef(node);
    });

    const callsBefore = mockListProposalHistory.mock.calls.length;
    act(() => {
      lastObserverInstance!.callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(mockListProposalHistory.mock.calls.length).toBe(callsBefore);
  });
});

describe("useInfiniteProposalHistory — loadMore nextPage guard", () => {
  it("skips loadMore when nextPage exceeds totalPages even if hasMore=true", async () => {
    // API returns hasMore: true but totalPages: 1 — can get out of sync
    mockListProposalHistory.mockResolvedValue({
      items: [makeProposal(1)],
      total: 1,
      totalPages: 1,
      hasMore: true,
      page: 1,
      perPage: 20,
    });

    const { result } = renderHook(() => useInfiniteProposalHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callsBefore = mockListProposalHistory.mock.calls.length;

    await act(async () => {
      await result.current.loadMore();
    });

    // nextPage (2) > totalPages (1) → early return, no new API call
    expect(mockListProposalHistory.mock.calls.length).toBe(callsBefore);
  });
});

describe("useInfiniteProposalHistory — page visibility refresh", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  it("calls refetch when page becomes visible after stale interval", async () => {
    jest.useRealTimers();
    mockListProposalHistory.mockResolvedValue(makePage(1, 5));

    renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => {
      expect(mockListProposalHistory).toHaveBeenCalledTimes(1);
    });

    // Simulate time passing beyond 2-minute refresh interval using Date mock
    const realNow = Date.now;
    Date.now = jest.fn(() => realNow() + 3 * 60 * 1000);

    mockListProposalHistory.mockResolvedValue(makePage(1, 5));

    await act(async () => {
      capturedVisibilityCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockListProposalHistory).toHaveBeenCalledTimes(2);
    Date.now = realNow;
  });

  it("does not refetch when page becomes visible within stale interval", async () => {
    jest.useRealTimers();
    mockListProposalHistory.mockResolvedValue(makePage(1, 5));

    renderHook(() => useInfiniteProposalHistory());

    await waitFor(() => {
      expect(mockListProposalHistory).toHaveBeenCalledTimes(1);
    });

    // Data was just fetched — still within the refresh interval
    await act(async () => {
      capturedVisibilityCallback?.();
      await Promise.resolve();
    });

    // Should NOT have triggered a second fetch
    expect(mockListProposalHistory).toHaveBeenCalledTimes(1);
  });
});
