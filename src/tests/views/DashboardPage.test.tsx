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

class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
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
