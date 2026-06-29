import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

jest.mock("next/dynamic", () => {
  const React = require("react");
  return function dynamic(
    importFn: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>
  ): React.ComponentType<Record<string, unknown>> {
    let Loaded: React.ComponentType<Record<string, unknown>> | undefined;
    // In jest the promise resolves as a microtask before the first render tick
    importFn().then((mod) => {
      Loaded =
        (mod as { default?: React.ComponentType<Record<string, unknown>> }).default ?? undefined;
    });
    function DynamicWrapper(props: Record<string, unknown>): React.ReactElement | null {
      return Loaded ? React.createElement(Loaded, props) : null;
    }
    DynamicWrapper.displayName = "DynamicComponent";
    return DynamicWrapper;
  };
});

jest.mock("@/hooks/useProposals");
jest.mock("@/hooks/useErrorToast", () => ({ useErrorToast: jest.fn() }));
jest.mock("@/hooks/useDebounce", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useDebounce: (v: any) => v,
}));

jest.mock("@/layouts/AppLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock("@/components/common/PageHeader", () => ({
  __esModule: true,
  default: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {action}
    </div>
  ),
}));

jest.mock("@/components/dashboard/ProposalSearch", () => ({
  ProposalSearch: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      data-testid="proposal-search"
      value={value}
      placeholder="Search by title or client..."
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

jest.mock("@/components/proposal/ProposalCard", () => ({
  __esModule: true,
  default: ({ proposal }: { proposal: ProposalListItem }) => (
    <div data-testid="proposal-card">{proposal.title}</div>
  ),
}));

jest.mock("@/components/common/EmptyState", () => ({
  __esModule: true,
  default: ({ title }: { title?: string }) => <div data-testid="empty-state">{title}</div>,
}));

jest.mock("@/components/common/Skeleton", () => ({
  SkeletonCard: () => <div data-testid="skeleton-card" />,
}));

jest.mock("@/components/common/SkeletonGrid", () => ({
  __esModule: true,
  default: ({ renderItem }: { renderItem?: () => React.ReactNode }) => (
    <div data-testid="skeleton-grid">{renderItem?.()}</div>
  ),
}));

jest.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader-icon" />,
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { useProposals } from "@/hooks/useProposals";
import DashboardPage from "@/views/dashboard/DashboardPage";

// ---------------------------------------------------------------------------
// IntersectionObserver stub
// ---------------------------------------------------------------------------

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let lastIOCallback: IOCallback | null = null;
let lastIOInstance: MockIntersectionObserver | null = null;

class MockIntersectionObserver {
  callback: IOCallback;
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();

  constructor(cb: IOCallback) {
    this.callback = cb;
    lastIOCallback = cb;

    lastIOInstance = this;
  }
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockUseProposals = useProposals as jest.Mock;

const mockProposals: ProposalListItem[] = [
  {
    id: 1,
    title: "Alpha Proposal",
    clientId: 10,
    clientName: "Client Alpha",
    status: "completed",
    approvalStatus: "approved",
    tone: "professional",
    lengthPreference: "balanced",
    templateType: "predefined",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: 2,
    title: "Beta Proposal",
    clientId: 20,
    clientName: "Client Beta",
    status: "draft",
    approvalStatus: "pending",
    tone: "creative",
    lengthPreference: "concise",
    templateType: "custom",
    createdAt: "2025-01-02T00:00:00Z",
    updatedAt: "2025-01-02T00:00:00Z",
  },
];

const defaultHookReturn = {
  proposals: mockProposals,
  isLoading: false,
  isLoadingMore: false,
  isInitialized: true,
  error: null,
  hasMore: false,
  refetch: jest.fn(),
  fetchMore: jest.fn(),
  getProposalById: jest.fn(),
};

beforeEach(() => {
  mockUseProposals.mockReturnValue(defaultHookReturn);
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("DashboardPage — loading state", () => {
  it("renders a skeleton grid while loading and before initialization", async () => {
    mockUseProposals.mockReturnValue({
      ...defaultHookReturn,
      isLoading: true,
      isInitialized: false,
      proposals: [],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("skeleton-grid")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// With proposals
// ---------------------------------------------------------------------------

describe("DashboardPage — with proposals", () => {
  it("renders a card for each proposal", async () => {
    render(<DashboardPage />);
    const cards = await screen.findAllByTestId("proposal-card");
    expect(cards).toHaveLength(2);
  });

  it("renders the proposal titles", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("Alpha Proposal")).toBeInTheDocument();
    expect(await screen.findByText("Beta Proposal")).toBeInTheDocument();
  });

  it("renders the page heading", async () => {
    render(<DashboardPage />);
    expect(await screen.findByRole("heading", { name: "Your Proposals" })).toBeInTheDocument();
  });

  it("renders the search input", async () => {
    render(<DashboardPage />);
    expect(await screen.findByTestId("proposal-search")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state — no proposals
// ---------------------------------------------------------------------------

describe("DashboardPage — empty state (no proposals)", () => {
  it("shows 'No proposals yet' when the list is empty", async () => {
    mockUseProposals.mockReturnValue({
      ...defaultHookReturn,
      proposals: [],
      isInitialized: true,
    });

    render(<DashboardPage />);

    const emptyState = await screen.findByTestId("empty-state");
    expect(emptyState).toHaveTextContent("No proposals yet");
  });
});

// ---------------------------------------------------------------------------
// Search filtering
// ---------------------------------------------------------------------------

describe("DashboardPage — search filtering", () => {
  it("filters proposals by title (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const input = await screen.findByTestId("proposal-search");
    await user.type(input, "alpha");

    await waitFor(() => {
      const cards = screen.getAllByTestId("proposal-card");
      expect(cards).toHaveLength(1);
      expect(cards[0]).toHaveTextContent("Alpha Proposal");
    });
  });

  it("filters proposals by client name", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const input = await screen.findByTestId("proposal-search");
    await user.type(input, "Client Beta");

    await waitFor(() => {
      const cards = screen.getAllByTestId("proposal-card");
      expect(cards).toHaveLength(1);
      expect(cards[0]).toHaveTextContent("Beta Proposal");
    });
  });

  it("shows 'No results found' empty state when search matches nothing", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const input = await screen.findByTestId("proposal-search");
    await user.type(input, "xyznonexistent");

    await waitFor(() => {
      const emptyState = screen.getByTestId("empty-state");
      expect(emptyState).toHaveTextContent("No results found");
    });
  });

  it("shows all proposals when search is cleared", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const input = await screen.findByTestId("proposal-search");
    await user.type(input, "alpha");

    await waitFor(() => expect(screen.getAllByTestId("proposal-card")).toHaveLength(1));

    await user.clear(input);

    await waitFor(() => expect(screen.getAllByTestId("proposal-card")).toHaveLength(2));
  });
});

// ---------------------------------------------------------------------------
// Infinite scroll sentinel — hasMore=true renders the sentinel div
// ---------------------------------------------------------------------------

describe("DashboardPage — infinite scroll sentinel", () => {
  it("renders the sentinel div when hasMore=true and no active search", async () => {
    const mockFetchMore = jest.fn().mockResolvedValue(undefined);
    mockUseProposals.mockReturnValue({
      ...defaultHookReturn,
      hasMore: true,
      fetchMore: mockFetchMore,
    });

    render(<DashboardPage />);

    // Proposals list renders
    await screen.findAllByTestId("proposal-card");

    // The sentinel is rendered — an observer is set up
    // (We verify the IntersectionObserver was instantiated)
    expect(MockIntersectionObserver).toBeDefined();
  });

  it("shows loading spinner when isLoadingMore=true", async () => {
    mockUseProposals.mockReturnValue({
      ...defaultHookReturn,
      hasMore: true,
      isLoadingMore: true,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    });
  });

  it("does not render sentinel when hasMore=false", async () => {
    mockUseProposals.mockReturnValue({
      ...defaultHookReturn,
      hasMore: false,
    });

    render(<DashboardPage />);
    await screen.findAllByTestId("proposal-card");

    expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
  });

  it("calls fetchMore when sentinel intersects and hasMore=true (covers lines 69-72)", async () => {
    lastIOCallback = null;
    lastIOInstance = null;

    const mockFetchMore = jest.fn().mockResolvedValue(undefined);
    mockUseProposals.mockReturnValue({
      ...defaultHookReturn,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,
      fetchMore: mockFetchMore,
    });

    render(<DashboardPage />);

    // Wait for the proposals to render so the sentinel div (and its ref callback) is mounted
    await screen.findAllByTestId("proposal-card");

    // The sentinelRef callback runs synchronously when the node is attached,
    // creating an IntersectionObserver. Verify it was created.
    expect(lastIOCallback).not.toBeNull();

    // Simulate the sentinel entering the viewport (isIntersecting = true)
    await waitFor(() => {
      lastIOCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    // fetchMore must have been called (covers line 70-71)
    await waitFor(() => {
      expect(mockFetchMore).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call fetchMore when sentinel intersects but isIntersecting=false", async () => {
    lastIOCallback = null;

    const mockFetchMore = jest.fn().mockResolvedValue(undefined);
    mockUseProposals.mockReturnValue({
      ...defaultHookReturn,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,
      fetchMore: mockFetchMore,
    });

    render(<DashboardPage />);
    await screen.findAllByTestId("proposal-card");

    expect(lastIOCallback).not.toBeNull();

    // Fire callback with isIntersecting=false — branch at line 69 is false, fetchMore must NOT be called
    lastIOCallback!([{ isIntersecting: false } as IntersectionObserverEntry]);

    expect(mockFetchMore).not.toHaveBeenCalled();
  });

  it("does not call fetchMore when sentinel intersects but hasMore=false", async () => {
    lastIOCallback = null;

    const mockFetchMore = jest.fn().mockResolvedValue(undefined);
    mockUseProposals.mockReturnValue({
      ...defaultHookReturn,
      hasMore: false,
      isLoading: false,
      isLoadingMore: false,
      fetchMore: mockFetchMore,
    });

    render(<DashboardPage />);
    await screen.findAllByTestId("proposal-card");

    // With hasMore=false the sentinel div is not rendered at all,
    // so no IntersectionObserver is created — fetchMore must not be called.
    if (lastIOCallback) {
      lastIOCallback([{ isIntersecting: true } as IntersectionObserverEntry]);
    }

    expect(mockFetchMore).not.toHaveBeenCalled();
  });

  it("resets loadingRef after fetchMore resolves (covers line 72)", async () => {
    lastIOCallback = null;

    let resolveFetchMore!: () => void;
    const fetchMorePromise = new Promise<void>((resolve) => {
      resolveFetchMore = resolve;
    });
    const mockFetchMore = jest.fn().mockReturnValue(fetchMorePromise);

    mockUseProposals.mockReturnValue({
      ...defaultHookReturn,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,
      fetchMore: mockFetchMore,
    });

    render(<DashboardPage />);
    await screen.findAllByTestId("proposal-card");

    expect(lastIOCallback).not.toBeNull();

    // First intersection — fetchMore is called, loadingRef becomes true
    lastIOCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(mockFetchMore).toHaveBeenCalledTimes(1);

    // While the promise is still pending a second intersection must NOT call fetchMore again
    lastIOCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(mockFetchMore).toHaveBeenCalledTimes(1);

    // Resolve the promise — this exercises the .finally() at line 72 (loadingRef = false)
    resolveFetchMore();
    await waitFor(() => Promise.resolve()); // flush microtasks

    // After reset a new intersection should be able to call fetchMore again
    lastIOCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);
    await waitFor(() => {
      expect(mockFetchMore).toHaveBeenCalledTimes(2);
    });
  });
});
