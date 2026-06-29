/**
 * Tests for useClientProposalsQuery hook
 *
 * Coverage targets:
 *   - enabled: clientId > 0 (true/false branch)
 *   - proposals: data ?? [] (both branches)
 *   - error: error ?? null (both branches)
 *   - isFetching, isLoading, isError fields
 */

// ---------------------------------------------------------------------------
// Virtual mock for @tanstack/react-query (package may not be installed)
// ---------------------------------------------------------------------------

const mockUseQuery = jest.fn();
jest.mock(
  "@tanstack/react-query",
  () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }),
  { virtual: true }
);

import { renderHook } from "@testing-library/react";
import { useClientProposalsQuery } from "@/hooks/useClientProposalsQuery";

jest.mock("@/services/proposal", () => ({
  listProposals: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockQuery(overrides: Record<string, unknown> = {}) {
  mockUseQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useClientProposalsQuery — proposals data ?? [] branch", () => {
  it("returns empty array when data is undefined (false branch of data ?? [])", () => {
    mockQuery({ data: undefined });
    const { result } = renderHook(() => useClientProposalsQuery(1));
    expect(result.current.proposals).toEqual([]);
  });

  it("returns data array when data is defined (true branch of data ?? [])", () => {
    const proposals = [{ id: 1, title: "Proposal 1" }];
    mockQuery({ data: proposals });
    const { result } = renderHook(() => useClientProposalsQuery(1));
    expect(result.current.proposals).toEqual(proposals);
  });
});

describe("useClientProposalsQuery — error ?? null branch", () => {
  it("returns null when error is null", () => {
    mockQuery({ error: null });
    const { result } = renderHook(() => useClientProposalsQuery(1));
    expect(result.current.error).toBeNull();
  });

  it("returns error object when error is set (true branch of error ?? null)", () => {
    const err = new Error("Server error");
    mockQuery({ error: err, isError: true });
    const { result } = renderHook(() => useClientProposalsQuery(1));
    expect(result.current.error).toBe(err);
    expect(result.current.isError).toBe(true);
  });
});

describe("useClientProposalsQuery — enabled: clientId > 0", () => {
  it("passes enabled=true when clientId > 0", () => {
    renderHook(() => useClientProposalsQuery(3));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it("passes enabled=false when clientId is 0", () => {
    renderHook(() => useClientProposalsQuery(0));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it("passes enabled=false when clientId is negative", () => {
    renderHook(() => useClientProposalsQuery(-1));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

describe("useClientProposalsQuery — loading state", () => {
  it("returns isLoading=true when query is loading", () => {
    mockQuery({ isLoading: true, isFetching: true });
    const { result } = renderHook(() => useClientProposalsQuery(1));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);
  });
});
