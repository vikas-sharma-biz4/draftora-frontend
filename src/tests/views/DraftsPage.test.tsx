/**
 * Tests for DraftsPage.tsx
 *
 * Coverage targets:
 *   - Renders the "Drafts" heading
 *   - Shows skeleton during loading
 *   - Shows EmptyState when no drafts exist
 *   - Renders a DraftCard for each draft returned by useDrafts
 *   - Search bar filters draft cards
 *   - Search with no match shows "No matching drafts" empty state
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// next/dynamic — resolves the imported module synchronously in tests
// (same pattern as DashboardPage.test.tsx)
// ---------------------------------------------------------------------------

jest.mock("next/dynamic", () => {
  const React = require("react");
  return function dynamic(
    importFn: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>
  ): React.ComponentType<Record<string, unknown>> {
    let Loaded: React.ComponentType<Record<string, unknown>> | undefined;
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

// ---------------------------------------------------------------------------
// Mocks — Next.js navigation
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/drafts",
}));

// ---------------------------------------------------------------------------
// Mocks — Stores
// ---------------------------------------------------------------------------

jest.mock("@/store/features/wizard/proposalWizardSlice", () => ({
  useWizardActions: () => ({
    updateProposalData: jest.fn(),
    setCurrentStep: jest.fn(),
    setMaxStepReached: jest.fn(),
    setGeneratedProposalId: jest.fn(),
    setCurrentProposalId: jest.fn(),
  }),
}));

jest.mock("@/store/features/drafts/draftSessionSlice", () => ({
  useDraftSessionStore: (selector: (s: unknown) => unknown) =>
    selector({
      setDraftStage: jest.fn(),
      setCompletedSteps: jest.fn(),
      setCurrentDraftId: jest.fn(),
      setFromHistory: jest.fn(),
    }),
}));

jest.mock("@/store/features/drafts/draftSlice", () => ({
  useDraftStore: (selector: (s: unknown) => unknown) =>
    selector({
      getDraft: jest.fn(),
      deleteDraft: jest.fn(),
      deleteAllDrafts: jest.fn(),
    }),
}));

// ---------------------------------------------------------------------------
// Mocks — Hooks
// ---------------------------------------------------------------------------

const mockUseDrafts = jest.fn();
jest.mock("@/hooks/useDrafts", () => ({
  useDrafts: () => mockUseDrafts(),
}));

jest.mock("@/hooks/useClients", () => ({
  useClients: () => ({ clients: [] }),
}));

jest.mock("@/hooks/useErrorToast", () => ({
  useErrorToast: jest.fn(),
}));

jest.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string) => value,
}));

// ---------------------------------------------------------------------------
// Mocks — Utilities
// ---------------------------------------------------------------------------

jest.mock("@/utils/draftTemplateCache", () => ({
  removeDraftTemplateMeta: jest.fn(),
}));

jest.mock("@/utils/toast", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/utils/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

jest.mock("@/utils/dateUtils", () => ({
  formatDateWithTime: (d: string) => d,
}));

// ---------------------------------------------------------------------------
// Mocks — Layout + common components  (__esModule: true required for default imports)
// ---------------------------------------------------------------------------

jest.mock("@/layouts/AppLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
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

jest.mock("@/components/common/EmptyState", () => ({
  __esModule: true,
  default: ({ title, onCtaClick }: { title: string; onCtaClick?: () => void }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      {onCtaClick && (
        <button onClick={onCtaClick} data-testid="empty-state-cta">
          Create
        </button>
      )}
    </div>
  ),
}));

jest.mock("@/components/common/SkeletonGrid", () => ({
  __esModule: true,
  default: () => <div data-testid="skeleton-grid" />,
}));

jest.mock("@/components/common/skeletons/DraftCardSkeleton", () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock("@/components/common/DraftCard", () => ({
  __esModule: true,
  default: ({
    draft,
    onLoad,
    onDelete,
  }: {
    draft: { id: string; title: string };
    onLoad: (id: string) => void;
    onDelete: (id: string, name: string, e: React.MouseEvent) => void;
  }) => (
    <div data-testid="draft-card">
      <span data-testid={`draft-title-${draft.id}`}>{draft.title}</span>
      <button onClick={() => onLoad(draft.id)} data-testid={`resume-${draft.id}`}>
        Resume
      </button>
      <button
        onClick={(e) => onDelete(draft.id, draft.title, e)}
        data-testid={`delete-${draft.id}`}
      >
        Delete
      </button>
    </div>
  ),
}));

jest.mock("@/components/common/SearchBar/SearchBar", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) => (
    <input
      data-testid="search-bar"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

jest.mock("@/components/common/Button", () => ({
  __esModule: true,
  default: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} data-testid="delete-all-btn">
      {children}
    </button>
  ),
}));

jest.mock("@/components/modals/TemplateSelectionModal/TemplateSelectionModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/modals/NewClientModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/modals/DeleteDraftModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/modals/DeleteAllDraftsModal", () => ({
  __esModule: true,
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Import component under test (after all mocks are declared)
// ---------------------------------------------------------------------------

import DraftsPage from "@/views/drafts/DraftsPage";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDraftMeta = (id: string, title: string, clientName = "Acme Corp") => ({
  id,
  title,
  clientName,
  status: "draft",
  lastLocation: "wizard_parameters",
  stage: "wizard_in_progress",
  proposalId: null,
  updatedAt: "2025-01-01T00:00:00Z",
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrafts.mockReturnValue({
    drafts: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
});

// ---------------------------------------------------------------------------
// Heading render
// ---------------------------------------------------------------------------

describe("DraftsPage — heading", () => {
  it("renders the 'Drafts' heading", () => {
    render(<DraftsPage />);
    expect(screen.getByRole("heading", { name: /drafts/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("DraftsPage — loading state", () => {
  it("shows the skeleton grid while isLoading is true", () => {
    mockUseDrafts.mockReturnValue({ drafts: [], isLoading: true, error: null, refetch: jest.fn() });
    render(<DraftsPage />);
    expect(screen.getByTestId("skeleton-grid")).toBeInTheDocument();
  });

  it("hides the skeleton grid once loading completes", () => {
    render(<DraftsPage />);
    expect(screen.queryByTestId("skeleton-grid")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("DraftsPage — empty state", () => {
  it("shows the 'Nothing to resume yet' empty state when no drafts exist", () => {
    render(<DraftsPage />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText(/nothing to resume yet/i)).toBeInTheDocument();
  });

  it("does not render any draft cards in the empty state", () => {
    render(<DraftsPage />);
    expect(screen.queryAllByTestId("draft-card")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Draft cards
// ---------------------------------------------------------------------------

describe("DraftsPage — draft cards", () => {
  it("renders a DraftCard for each draft returned by useDrafts", () => {
    mockUseDrafts.mockReturnValue({
      drafts: [makeDraftMeta("d-1", "Proposal A"), makeDraftMeta("d-2", "Proposal B")],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<DraftsPage />);
    expect(screen.getAllByTestId("draft-card")).toHaveLength(2);
  });

  it("displays the draft title inside the card", () => {
    mockUseDrafts.mockReturnValue({
      drafts: [makeDraftMeta("d-1", "Cloud Migration")],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<DraftsPage />);
    expect(screen.getByTestId("draft-title-d-1")).toHaveTextContent("Cloud Migration");
  });

  it("does not show the empty state when drafts exist", () => {
    mockUseDrafts.mockReturnValue({
      drafts: [makeDraftMeta("d-1", "My Proposal")],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<DraftsPage />);
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Search filtering
// ---------------------------------------------------------------------------

describe("DraftsPage — search", () => {
  beforeEach(() => {
    mockUseDrafts.mockReturnValue({
      drafts: [makeDraftMeta("d-1", "Cloud Migration"), makeDraftMeta("d-2", "Security Audit")],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it("shows all draft cards when the search query is empty", () => {
    render(<DraftsPage />);
    expect(screen.getAllByTestId("draft-card")).toHaveLength(2);
  });

  it("shows only matching draft cards when a query is typed", async () => {
    render(<DraftsPage />);
    fireEvent.change(screen.getByTestId("search-bar"), { target: { value: "cloud" } });

    await waitFor(() => {
      expect(screen.getAllByTestId("draft-card")).toHaveLength(1);
      expect(screen.getByText("Cloud Migration")).toBeInTheDocument();
    });
  });

  it("shows 'No matching drafts' when the query matches nothing", async () => {
    render(<DraftsPage />);
    fireEvent.change(screen.getByTestId("search-bar"), { target: { value: "zzz_no_match" } });

    await waitFor(() => {
      expect(screen.queryAllByTestId("draft-card")).toHaveLength(0);
      expect(screen.getByText(/no matching drafts/i)).toBeInTheDocument();
    });
  });

  it("restores all cards when the search query is cleared", async () => {
    render(<DraftsPage />);
    const searchBar = screen.getByTestId("search-bar");

    fireEvent.change(searchBar, { target: { value: "cloud" } });
    await waitFor(() => expect(screen.getAllByTestId("draft-card")).toHaveLength(1));

    fireEvent.change(searchBar, { target: { value: "" } });
    await waitFor(() => expect(screen.getAllByTestId("draft-card")).toHaveLength(2));
  });
});
