/**
 * Tests for src/hooks/useClients.ts
 */

jest.mock("@/store/features/clients/clientSlice", () => ({
  useClientStore: jest.fn(),
}));

jest.mock("@/hooks/usePageVisibility", () => ({
  usePageVisibility: jest.fn(),
}));

import { renderHook, act } from "@testing-library/react";
import { useClients, useClient } from "@/hooks/useClients";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { usePageVisibility } from "@/hooks/usePageVisibility";

const mockFetchClients = jest.fn();
const mockGetClientById = jest.fn();

const mockClientList = [
  {
    id: 1,
    name: "Acme Corp",
    industry: "Tech",
    status: "active" as const,
    notes: null,
    createdAt: "",
    updatedAt: "",
    documents: [],
  },
];

function setupClientStoreMock(overrides: Record<string, unknown> = {}) {
  const storeState = {
    clients: mockClientList,
    isLoading: false,
    error: null,
    fetchClients: mockFetchClients,
    getClientById: mockGetClientById,
    isInitialized: false,
    ...overrides,
  };
  (useClientStore as jest.Mock).mockImplementation((selector: (s: typeof storeState) => unknown) =>
    selector(storeState)
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setupClientStoreMock();
  (usePageVisibility as jest.Mock).mockImplementation(() => {});
  mockFetchClients.mockResolvedValue(undefined);
  mockGetClientById.mockReturnValue(undefined);
});

// ---------------------------------------------------------------------------
// useClients — return values
// ---------------------------------------------------------------------------

describe("useClients — return values", () => {
  it("returns clients from store", () => {
    const { result } = renderHook(() => useClients());
    expect(result.current.clients).toEqual(mockClientList);
  });

  it("returns isLoading from store", () => {
    setupClientStoreMock({ isLoading: true });
    const { result } = renderHook(() => useClients());
    expect(result.current.isLoading).toBe(true);
  });

  it("returns error from store", () => {
    setupClientStoreMock({ error: "Network error" });
    const { result } = renderHook(() => useClients());
    expect(result.current.error).toBe("Network error");
  });

  it("returns getClientById function from store", () => {
    const { result } = renderHook(() => useClients());
    expect(typeof result.current.getClientById).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// useClients — autoFetch behaviour
// ---------------------------------------------------------------------------

describe("useClients — autoFetch", () => {
  it("calls fetchClients(false) on mount when autoFetch=true", () => {
    renderHook(() => useClients({ autoFetch: true }));
    expect(mockFetchClients).toHaveBeenCalledWith(false);
  });

  it("calls fetchClients(true) when force=true", () => {
    renderHook(() => useClients({ force: true }));
    expect(mockFetchClients).toHaveBeenCalledWith(true);
  });

  it("does not call fetchClients when autoFetch=false", () => {
    renderHook(() => useClients({ autoFetch: false }));
    expect(mockFetchClients).not.toHaveBeenCalled();
  });

  it("registers page visibility callback", () => {
    renderHook(() => useClients());
    expect(usePageVisibility).toHaveBeenCalled();
  });

  it("page visibility callback calls fetchClients when autoFetch=true", () => {
    let capturedCallback: (() => void) | null = null;
    (usePageVisibility as jest.Mock).mockImplementation((cb: () => void) => {
      capturedCallback = cb;
    });

    renderHook(() => useClients({ autoFetch: true }));
    mockFetchClients.mockClear();
    capturedCallback!();
    expect(mockFetchClients).toHaveBeenCalled();
  });

  it("page visibility callback does not call fetchClients when autoFetch=false", () => {
    let capturedCallback: (() => void) | null = null;
    (usePageVisibility as jest.Mock).mockImplementation((cb: () => void) => {
      capturedCallback = cb;
    });

    renderHook(() => useClients({ autoFetch: false }));
    mockFetchClients.mockClear();
    capturedCallback!();
    expect(mockFetchClients).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useClients — refetch
// ---------------------------------------------------------------------------

describe("useClients — refetch", () => {
  it("calls fetchClients(true) when refetch() is called", async () => {
    const { result } = renderHook(() => useClients());
    mockFetchClients.mockClear();
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockFetchClients).toHaveBeenCalledWith(true);
  });
});

// ---------------------------------------------------------------------------
// useClient — single client
// ---------------------------------------------------------------------------

describe("useClient", () => {
  it("returns client for the given ID", () => {
    const mockClient = { ...mockClientList[0] };
    mockGetClientById.mockReturnValue(mockClient);
    const { result } = renderHook(() => useClient(1));
    expect(result.current.client).toEqual(mockClient);
  });

  it("returns undefined when client not found", () => {
    mockGetClientById.mockReturnValue(undefined);
    const { result } = renderHook(() => useClient(999));
    expect(result.current.client).toBeUndefined();
  });

  it("fetches clients when not initialized", () => {
    setupClientStoreMock({ isInitialized: false });
    renderHook(() => useClient(1));
    expect(mockFetchClients).toHaveBeenCalled();
  });

  it("does not fetch when already initialized", () => {
    setupClientStoreMock({ isInitialized: true });
    renderHook(() => useClient(1));
    expect(mockFetchClients).not.toHaveBeenCalled();
  });

  it("refetch forces a new fetch", async () => {
    const { result } = renderHook(() => useClient(1));
    mockFetchClients.mockClear();
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockFetchClients).toHaveBeenCalledWith(true);
  });

  it("returns isLoading and error from store", () => {
    setupClientStoreMock({ isLoading: true, error: "Server error" });
    const { result } = renderHook(() => useClient(1));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe("Server error");
  });
});
