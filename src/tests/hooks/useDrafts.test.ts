/**
 * Tests for src/hooks/useDrafts.ts
 */

jest.mock("@/store/features/drafts/draftSlice", () => ({
  useDraftStore: jest.fn(),
}));

jest.mock("@/hooks/usePageVisibility", () => ({
  usePageVisibility: jest.fn(),
}));

import { renderHook, act } from "@testing-library/react";
import { useDrafts } from "@/hooks/useDrafts";
import { useDraftStore } from "@/store/features/drafts/draftSlice";
import { usePageVisibility } from "@/hooks/usePageVisibility";

const mockFetchDrafts = jest.fn();
const mockGetDraftById = jest.fn();

const mockDraftList = [{ id: "draft-1", title: "My Draft", clientName: "Acme" }];

function setupDraftStoreMock(overrides: Record<string, unknown> = {}) {
  const storeState = {
    drafts: mockDraftList,
    isLoading: false,
    error: null,
    fetchDrafts: mockFetchDrafts,
    getDraftById: mockGetDraftById,
    ...overrides,
  };
  (useDraftStore as jest.Mock).mockImplementation((selector: (s: typeof storeState) => unknown) =>
    selector(storeState)
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDraftStoreMock();
  (usePageVisibility as jest.Mock).mockImplementation(() => {});
  mockFetchDrafts.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Return values
// ---------------------------------------------------------------------------

describe("useDrafts — return values", () => {
  it("returns drafts from store", () => {
    const { result } = renderHook(() => useDrafts());
    expect(result.current.drafts).toEqual(mockDraftList);
  });

  it("returns isLoading from store", () => {
    setupDraftStoreMock({ isLoading: true });
    const { result } = renderHook(() => useDrafts());
    expect(result.current.isLoading).toBe(true);
  });

  it("returns error from store", () => {
    setupDraftStoreMock({ error: "Fetch failed" });
    const { result } = renderHook(() => useDrafts());
    expect(result.current.error).toBe("Fetch failed");
  });

  it("returns getDraftById function", () => {
    const { result } = renderHook(() => useDrafts());
    expect(typeof result.current.getDraftById).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// autoFetch behaviour
// ---------------------------------------------------------------------------

describe("useDrafts — autoFetch", () => {
  it("calls fetchDrafts(false) on mount when autoFetch=true", () => {
    renderHook(() => useDrafts({ autoFetch: true }));
    expect(mockFetchDrafts).toHaveBeenCalledWith(false);
  });

  it("calls fetchDrafts(true) when force=true", () => {
    renderHook(() => useDrafts({ force: true }));
    expect(mockFetchDrafts).toHaveBeenCalledWith(true);
  });

  it("does not call fetchDrafts when autoFetch=false", () => {
    renderHook(() => useDrafts({ autoFetch: false }));
    expect(mockFetchDrafts).not.toHaveBeenCalled();
  });

  it("registers page visibility callback", () => {
    renderHook(() => useDrafts());
    expect(usePageVisibility).toHaveBeenCalled();
  });

  it("visibility callback calls fetchDrafts when autoFetch=true", () => {
    let capturedCb: (() => void) | null = null;
    (usePageVisibility as jest.Mock).mockImplementation((cb: () => void) => {
      capturedCb = cb;
    });

    renderHook(() => useDrafts({ autoFetch: true }));
    mockFetchDrafts.mockClear();
    capturedCb!();
    expect(mockFetchDrafts).toHaveBeenCalled();
  });

  it("visibility callback skips fetch when autoFetch=false", () => {
    let capturedCb: (() => void) | null = null;
    (usePageVisibility as jest.Mock).mockImplementation((cb: () => void) => {
      capturedCb = cb;
    });

    renderHook(() => useDrafts({ autoFetch: false }));
    mockFetchDrafts.mockClear();
    capturedCb!();
    expect(mockFetchDrafts).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// refetch
// ---------------------------------------------------------------------------

describe("useDrafts — refetch", () => {
  it("calls fetchDrafts(true) when refetch() is called", async () => {
    const { result } = renderHook(() => useDrafts());
    mockFetchDrafts.mockClear();
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockFetchDrafts).toHaveBeenCalledWith(true);
  });
});
