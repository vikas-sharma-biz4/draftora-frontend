/**
 * Tests for useClientInvoicesQuery hook
 *
 * Coverage targets:
 *   - enabled: clientId > 0 (true/false branch)
 *   - invoices: data ?? [] (both branches)
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
import { useClientInvoicesQuery } from "@/hooks/useClientInvoicesQuery";

jest.mock("@/services/artifact.service", () => ({
  listArtifacts: jest.fn(),
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

describe("useClientInvoicesQuery — invoices data ?? [] branch", () => {
  it("returns empty array when data is undefined (false branch of data ?? [])", () => {
    mockQuery({ data: undefined });
    const { result } = renderHook(() => useClientInvoicesQuery(1));
    expect(result.current.invoices).toEqual([]);
  });

  it("returns data array when data is defined (true branch of data ?? [])", () => {
    const invoices = [{ id: 1, title: "Invoice 1" }];
    mockQuery({ data: invoices });
    const { result } = renderHook(() => useClientInvoicesQuery(1));
    expect(result.current.invoices).toEqual(invoices);
  });
});

describe("useClientInvoicesQuery — error ?? null branch", () => {
  it("returns null when error is null", () => {
    mockQuery({ error: null });
    const { result } = renderHook(() => useClientInvoicesQuery(1));
    expect(result.current.error).toBeNull();
  });

  it("returns error when error is set (true branch of error ?? null)", () => {
    const err = new Error("Network error");
    mockQuery({ error: err, isError: true });
    const { result } = renderHook(() => useClientInvoicesQuery(1));
    expect(result.current.error).toBe(err);
    expect(result.current.isError).toBe(true);
  });
});

describe("useClientInvoicesQuery — enabled: clientId > 0", () => {
  it("passes enabled=true when clientId > 0", () => {
    renderHook(() => useClientInvoicesQuery(5));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it("passes enabled=false when clientId is 0", () => {
    renderHook(() => useClientInvoicesQuery(0));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it("passes enabled=false when clientId is negative", () => {
    renderHook(() => useClientInvoicesQuery(-3));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

describe("useClientInvoicesQuery — loading and fetching state", () => {
  it("returns isLoading=true when query is loading", () => {
    mockQuery({ isLoading: true, isFetching: true });
    const { result } = renderHook(() => useClientInvoicesQuery(1));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);
  });

  it("returns isLoading=false when query is done", () => {
    mockQuery({ isLoading: false, data: [] });
    const { result } = renderHook(() => useClientInvoicesQuery(1));
    expect(result.current.isLoading).toBe(false);
  });
});
