/**
 * Tests for proposalSlice Zustand store
 *
 * Coverage targets:
 *   - Cache TTL validation (isCacheValid, isHistoryCacheValid)
 *   - Concurrent fetch prevention (isLoading guard)
 *   - Cache invalidation (both caches cleared)
 *   - Computed selectors (getApproved, getRejected, getPending, getHistory)
 *     - approved/rejected/history selectors filter from historyProposals
 *     - pending selector filters from all proposals
 *   - CRUD operations (add, update, remove, set)
 *   - Error handling on fetch failure
 *   - Pagination (fetchMoreProposals, hasMore)
 *   - fetchProposalHistory writes only to historyProposals (M1 regression guard)
 */

import { useProposalStore, INITIAL_PROPOSAL_STATE } from "@/store/features/proposals/proposalSlice";
import * as proposalApi from "@/services/proposal";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockProposals: ProposalListItem[] = [
  {
    id: 1,
    title: "Alpha Proposal",
    clientId: 10,
    clientName: "Client A",
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
    clientName: "Client B",
    status: "completed",
    approvalStatus: "rejected",
    tone: "creative",
    lengthPreference: "concise",
    templateType: "custom",
    createdAt: "2025-01-02T00:00:00Z",
    updatedAt: "2025-01-02T00:00:00Z",
  },
  {
    id: 3,
    title: "Gamma Proposal",
    clientId: 30,
    clientName: "Client C",
    status: "in_progress",
    approvalStatus: "pending",
    tone: "technical",
    lengthPreference: "comprehensive",
    templateType: "scratch",
    createdAt: "2025-01-03T00:00:00Z",
    updatedAt: "2025-01-03T00:00:00Z",
  },
];

jest.mock("@/services/proposal", () => ({
  listProposals: jest.fn(),
  listProposalHistory: jest.fn(),
}));

const mockListProposals = proposalApi.listProposals as jest.Mock;
const mockListProposalHistory = proposalApi.listProposalHistory as jest.Mock;

beforeEach(() => {
  useProposalStore.setState(INITIAL_PROPOSAL_STATE);
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("proposalSlice — initial state", () => {
  it("starts with empty proposals array", () => {
    expect(useProposalStore.getState().proposals).toEqual([]);
  });

  it("starts with empty historyProposals array", () => {
    expect(useProposalStore.getState().historyProposals).toEqual([]);
  });

  it("starts with isLoading false", () => {
    expect(useProposalStore.getState().isLoading).toBe(false);
  });

  it("starts with isLoadingMore false", () => {
    expect(useProposalStore.getState().isLoadingMore).toBe(false);
  });

  it("starts with isInitialized false", () => {
    expect(useProposalStore.getState().isInitialized).toBe(false);
  });

  it("starts with historyInitialized false", () => {
    expect(useProposalStore.getState().historyInitialized).toBe(false);
  });

  it("starts with lastFetched null", () => {
    expect(useProposalStore.getState().lastFetched).toBeNull();
  });

  it("starts with historyLastFetched null", () => {
    expect(useProposalStore.getState().historyLastFetched).toBeNull();
  });

  it("starts with error null", () => {
    expect(useProposalStore.getState().error).toBeNull();
  });

  it("starts with page 1", () => {
    expect(useProposalStore.getState().page).toBe(1);
  });

  it("starts with hasMore false", () => {
    expect(useProposalStore.getState().hasMore).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCacheValid (all-proposals)
// ---------------------------------------------------------------------------

describe("proposalSlice — isCacheValid", () => {
  it("returns false when not initialized", () => {
    expect(useProposalStore.getState().isCacheValid()).toBe(false);
  });

  it("returns false when lastFetched is null", () => {
    useProposalStore.setState({ isInitialized: true, lastFetched: null });
    expect(useProposalStore.getState().isCacheValid()).toBe(false);
  });

  it("returns true when lastFetched is within TTL", () => {
    useProposalStore.setState({
      isInitialized: true,
      lastFetched: Date.now() - 60_000,
    });
    expect(useProposalStore.getState().isCacheValid()).toBe(true);
  });

  it("returns false when lastFetched is beyond TTL (3 minutes)", () => {
    useProposalStore.setState({
      isInitialized: true,
      lastFetched: Date.now() - 4 * 60_000,
    });
    expect(useProposalStore.getState().isCacheValid()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isHistoryCacheValid
// ---------------------------------------------------------------------------

describe("proposalSlice — isHistoryCacheValid", () => {
  it("returns false when historyInitialized is false", () => {
    expect(useProposalStore.getState().isHistoryCacheValid()).toBe(false);
  });

  it("returns false when historyLastFetched is null", () => {
    useProposalStore.setState({ historyInitialized: true, historyLastFetched: null });
    expect(useProposalStore.getState().isHistoryCacheValid()).toBe(false);
  });

  it("returns true when historyLastFetched is within TTL", () => {
    useProposalStore.setState({
      historyInitialized: true,
      historyLastFetched: Date.now() - 60_000,
    });
    expect(useProposalStore.getState().isHistoryCacheValid()).toBe(true);
  });

  it("returns false when historyLastFetched is beyond TTL", () => {
    useProposalStore.setState({
      historyInitialized: true,
      historyLastFetched: Date.now() - 4 * 60_000,
    });
    expect(useProposalStore.getState().isHistoryCacheValid()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fetchProposals — cache & concurrent fetch prevention
// ---------------------------------------------------------------------------

describe("proposalSlice — fetchProposals", () => {
  it("fetches from API when cache is invalid", async () => {
    mockListProposals.mockResolvedValue(mockProposals);

    await useProposalStore.getState().fetchProposals();

    expect(mockListProposals).toHaveBeenCalledTimes(1);
    expect(useProposalStore.getState().proposals).toHaveLength(3);
    expect(useProposalStore.getState().isInitialized).toBe(true);
    expect(useProposalStore.getState().isLoading).toBe(false);
    expect(useProposalStore.getState().page).toBe(1);
  });

  it("skips API call when cache is valid", async () => {
    useProposalStore.setState({
      isInitialized: true,
      lastFetched: Date.now(),
      proposals: mockProposals,
    });

    await useProposalStore.getState().fetchProposals();

    expect(mockListProposals).not.toHaveBeenCalled();
  });

  it("forces API call when force=true even with valid cache", async () => {
    useProposalStore.setState({
      isInitialized: true,
      lastFetched: Date.now(),
      proposals: mockProposals,
    });
    mockListProposals.mockResolvedValue(mockProposals);

    await useProposalStore.getState().fetchProposals(true);

    expect(mockListProposals).toHaveBeenCalledTimes(1);
  });

  it("prevents concurrent fetch when isLoading is true", async () => {
    useProposalStore.setState({ isLoading: true });

    await useProposalStore.getState().fetchProposals();

    expect(mockListProposals).not.toHaveBeenCalled();
  });

  it("sorts proposals by createdAt descending (newest first)", async () => {
    mockListProposals.mockResolvedValue([...mockProposals].reverse());

    await useProposalStore.getState().fetchProposals();

    const { proposals } = useProposalStore.getState();
    expect(proposals[0].id).toBe(3); // Gamma — Jan 3
    expect(proposals[1].id).toBe(2); // Beta — Jan 2
    expect(proposals[2].id).toBe(1); // Alpha — Jan 1
  });

  it("sets hasMore to true when returned items fill a full page", async () => {
    const fullPage = Array.from({ length: 20 }, (_, i) => ({
      ...mockProposals[0],
      id: i + 1,
      createdAt: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      updatedAt: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    }));
    mockListProposals.mockResolvedValue(fullPage);

    await useProposalStore.getState().fetchProposals();

    expect(useProposalStore.getState().hasMore).toBe(true);
  });

  it("sets hasMore to false when returned items are fewer than a full page", async () => {
    mockListProposals.mockResolvedValue(mockProposals);

    await useProposalStore.getState().fetchProposals();

    expect(useProposalStore.getState().hasMore).toBe(false);
  });

  it("sets error on API failure", async () => {
    mockListProposals.mockRejectedValue(new Error("Network error"));

    await expect(useProposalStore.getState().fetchProposals(true)).rejects.toThrow("Network error");

    expect(useProposalStore.getState().error).toBe("Network error");
    expect(useProposalStore.getState().isLoading).toBe(false);
  });

  it("sets generic error message on non-Error thrown", async () => {
    mockListProposals.mockRejectedValue("string error");

    await expect(useProposalStore.getState().fetchProposals(true)).rejects.toBe("string error");

    expect(useProposalStore.getState().error).toBe("Failed to fetch proposals");
  });

  // M1 regression guard: fetchProposals must NOT write to historyProposals
  it("does not overwrite historyProposals when fetching all proposals", async () => {
    const historyItems = [mockProposals[0]];
    useProposalStore.setState({ historyProposals: historyItems });
    mockListProposals.mockResolvedValue(mockProposals);

    await useProposalStore.getState().fetchProposals(true);

    expect(useProposalStore.getState().historyProposals).toEqual(historyItems);
  });
});

// ---------------------------------------------------------------------------
// fetchProposalHistory — independent cache, no allProposals contamination (M1)
// ---------------------------------------------------------------------------

describe("proposalSlice — fetchProposalHistory", () => {
  it("writes to historyProposals, not proposals", async () => {
    mockListProposalHistory.mockResolvedValue({ items: mockProposals, hasMore: false });

    await useProposalStore.getState().fetchProposalHistory(true);

    expect(useProposalStore.getState().historyProposals).toHaveLength(3);
    expect(useProposalStore.getState().proposals).toHaveLength(0); // all-proposals untouched
  });

  it("sets historyInitialized and historyLastFetched on success", async () => {
    mockListProposalHistory.mockResolvedValue({ items: mockProposals, hasMore: false });

    await useProposalStore.getState().fetchProposalHistory(true);

    expect(useProposalStore.getState().historyInitialized).toBe(true);
    expect(useProposalStore.getState().historyLastFetched).not.toBeNull();
  });

  it("skips fetch when history cache is valid", async () => {
    useProposalStore.setState({
      historyInitialized: true,
      historyLastFetched: Date.now(),
      historyProposals: mockProposals,
    });

    await useProposalStore.getState().fetchProposalHistory();

    expect(mockListProposalHistory).not.toHaveBeenCalled();
  });

  it("forces fetch when force=true even with valid history cache", async () => {
    useProposalStore.setState({
      historyInitialized: true,
      historyLastFetched: Date.now(),
      historyProposals: mockProposals,
    });
    mockListProposalHistory.mockResolvedValue({ items: mockProposals, hasMore: false });

    await useProposalStore.getState().fetchProposalHistory(true);

    expect(mockListProposalHistory).toHaveBeenCalledTimes(1);
  });

  it("does NOT use allProposals isCacheValid — history has its own TTL", async () => {
    // allProposals cache is fresh, but history has never been fetched
    useProposalStore.setState({
      isInitialized: true,
      lastFetched: Date.now(), // allProposals cache valid
      historyInitialized: false,
      historyLastFetched: null, // history cache invalid
    });
    mockListProposalHistory.mockResolvedValue({ items: mockProposals, hasMore: false });

    // Should fetch because history cache is invalid, regardless of allProposals cache
    await useProposalStore.getState().fetchProposalHistory();

    expect(mockListProposalHistory).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// fetchMoreProposals — pagination
// ---------------------------------------------------------------------------

describe("proposalSlice — fetchMoreProposals", () => {
  it("does nothing when hasMore is false", async () => {
    useProposalStore.setState({ hasMore: false, page: 1 });

    await useProposalStore.getState().fetchMoreProposals();

    expect(mockListProposals).not.toHaveBeenCalled();
  });

  it("does nothing when isLoading is true", async () => {
    useProposalStore.setState({ hasMore: true, isLoading: true });

    await useProposalStore.getState().fetchMoreProposals();

    expect(mockListProposals).not.toHaveBeenCalled();
  });

  it("does nothing when isLoadingMore is true", async () => {
    useProposalStore.setState({ hasMore: true, isLoadingMore: true });

    await useProposalStore.getState().fetchMoreProposals();

    expect(mockListProposals).not.toHaveBeenCalled();
  });

  it("appends next page of proposals and increments page counter", async () => {
    const page1 = mockProposals.slice(0, 2);
    const page2 = [mockProposals[2]];

    useProposalStore.setState({
      proposals: page1,
      hasMore: true,
      page: 1,
      isInitialized: true,
      lastFetched: Date.now(),
    });
    mockListProposals.mockResolvedValue(page2);

    await useProposalStore.getState().fetchMoreProposals();

    const state = useProposalStore.getState();
    expect(mockListProposals).toHaveBeenCalledTimes(1);
    expect(state.proposals).toHaveLength(3);
    expect(state.page).toBe(2);
    expect(state.isLoadingMore).toBe(false);
  });

  it("sets hasMore to false when next page has fewer items than page size", async () => {
    useProposalStore.setState({
      proposals: mockProposals,
      hasMore: true,
      page: 1,
      isInitialized: true,
    });
    mockListProposals.mockResolvedValue([mockProposals[0]]);

    await useProposalStore.getState().fetchMoreProposals();

    expect(useProposalStore.getState().hasMore).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Computed selectors
// ---------------------------------------------------------------------------

describe("proposalSlice — computed selectors", () => {
  it("getProposalById returns matching proposal from allProposals", () => {
    useProposalStore.setState({ proposals: mockProposals });
    const result = useProposalStore.getState().getProposalById(2);
    expect(result?.title).toBe("Beta Proposal");
  });

  it("getProposalById returns undefined for non-existent id", () => {
    useProposalStore.setState({ proposals: mockProposals });
    expect(useProposalStore.getState().getProposalById(999)).toBeUndefined();
  });

  // History selectors read from historyProposals, NOT allProposals
  it("getApprovedProposals returns only approved items from historyProposals", () => {
    useProposalStore.setState({ historyProposals: mockProposals });
    const result = useProposalStore.getState().getApprovedProposals();
    expect(result).toHaveLength(1);
    expect(result[0].approvalStatus).toBe("approved");
  });

  it("getRejectedProposals returns only rejected items from historyProposals", () => {
    useProposalStore.setState({ historyProposals: mockProposals });
    const result = useProposalStore.getState().getRejectedProposals();
    expect(result).toHaveLength(1);
    expect(result[0].approvalStatus).toBe("rejected");
  });

  it("getHistoryProposals returns all historyProposals", () => {
    useProposalStore.setState({ historyProposals: mockProposals });
    const result = useProposalStore.getState().getHistoryProposals();
    expect(result).toHaveLength(3);
  });

  it("getPendingProposals returns only pending items from allProposals", () => {
    useProposalStore.setState({ proposals: mockProposals });
    const result = useProposalStore.getState().getPendingProposals();
    expect(result).toHaveLength(1);
    expect(result[0].approvalStatus).toBe("pending");
  });

  // Isolation guard: history selectors must not be affected by allProposals changes
  it("getApprovedProposals returns empty when historyProposals is empty even if allProposals has approved items", () => {
    useProposalStore.setState({
      proposals: mockProposals, // has approved items
      historyProposals: [],
    });
    expect(useProposalStore.getState().getApprovedProposals()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

describe("proposalSlice — CRUD operations", () => {
  it("addProposal prepends to allProposals list", () => {
    const newProposal: ProposalListItem = {
      id: 99,
      title: "New",
      clientId: 1,
      clientName: "C",
      status: "completed",
      approvalStatus: "pending",
      tone: "professional",
      lengthPreference: "balanced",
      templateType: "scratch",
      createdAt: "2025-06-01T00:00:00Z",
      updatedAt: "2025-06-01T00:00:00Z",
    };

    useProposalStore.getState().addProposal(newProposal);

    const { proposals } = useProposalStore.getState();
    expect(proposals[0].id).toBe(99);
    expect(proposals).toHaveLength(1);
  });

  it("updateProposal merges partial updates in allProposals", () => {
    useProposalStore.setState({ proposals: mockProposals });

    useProposalStore.getState().updateProposal(1, { title: "Updated Alpha" });

    const proposal = useProposalStore.getState().getProposalById(1);
    expect(proposal?.title).toBe("Updated Alpha");
    expect(proposal?.clientName).toBe("Client A");
  });

  it("removeProposal removes by id from allProposals", () => {
    useProposalStore.setState({ proposals: mockProposals });

    useProposalStore.getState().removeProposal(2);

    const { proposals } = useProposalStore.getState();
    expect(proposals).toHaveLength(2);
    expect(proposals.find((p) => p.id === 2)).toBeUndefined();
  });

  it("setProposals replaces entire allProposals list and marks initialized", () => {
    useProposalStore.getState().setProposals(mockProposals);

    const state = useProposalStore.getState();
    expect(state.proposals).toEqual(mockProposals);
    expect(state.isInitialized).toBe(true);
    expect(state.lastFetched).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// invalidateCache — clears both caches
// ---------------------------------------------------------------------------

describe("proposalSlice — invalidateCache", () => {
  it("resets lastFetched but preserves isInitialized", () => {
    useProposalStore.setState({
      isInitialized: true,
      lastFetched: Date.now(),
    });

    useProposalStore.getState().invalidateCache();

    expect(useProposalStore.getState().lastFetched).toBeNull();
    expect(useProposalStore.getState().isInitialized).toBe(true);
  });

  it("also resets historyLastFetched", () => {
    useProposalStore.setState({
      historyInitialized: true,
      historyLastFetched: Date.now(),
    });

    useProposalStore.getState().invalidateCache();

    expect(useProposalStore.getState().historyLastFetched).toBeNull();
    expect(useProposalStore.getState().historyInitialized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fetchVersionDrafts — all branch paths
// ---------------------------------------------------------------------------

describe("proposalSlice — fetchVersionDrafts", () => {
  it("returns early when versionDrafts cache is fresh and force=false", async () => {
    useProposalStore.setState({
      versionDrafts: [mockProposals[2]],
      versionDraftsLastFetched: Date.now(), // fresh
    });

    await useProposalStore.getState().fetchVersionDrafts(false);

    expect(mockListProposals).not.toHaveBeenCalled();
  });

  it("derives version drafts in-memory when main proposals cache is warm", async () => {
    const versionDraft: ProposalListItem = {
      ...mockProposals[2],
      id: 500,
      approvalStatus: "pending",
      parentProposalId: 1,
    };
    useProposalStore.setState({
      proposals: [mockProposals[0], versionDraft],
      isInitialized: true,
      lastFetched: Date.now(), // warm proposals cache
    });

    await useProposalStore.getState().fetchVersionDrafts(true);

    expect(mockListProposals).not.toHaveBeenCalled();
    expect(useProposalStore.getState().versionDrafts).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 500 })])
    );
  });

  it("excludes proposals without parentProposalId from in-memory derivation", async () => {
    useProposalStore.setState({
      proposals: mockProposals, // none have parentProposalId
      isInitialized: true,
      lastFetched: Date.now(),
    });

    await useProposalStore.getState().fetchVersionDrafts(true);

    expect(useProposalStore.getState().versionDrafts).toHaveLength(0);
  });

  it("calls listProposals API when main proposals cache is stale/empty", async () => {
    const versionDraft: ProposalListItem = {
      ...mockProposals[2],
      id: 600,
      approvalStatus: "pending",
      parentProposalId: 2,
    };
    mockListProposals.mockResolvedValue([mockProposals[0], versionDraft]);

    // proposals not initialized → API call path
    await useProposalStore.getState().fetchVersionDrafts(true);

    expect(mockListProposals).toHaveBeenCalledTimes(1);
    expect(useProposalStore.getState().versionDrafts).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 600 })])
    );
  });

  it("does not include proposals with pending status but null parentProposalId from API", async () => {
    mockListProposals.mockResolvedValue([mockProposals[2]]); // pending but no parentProposalId

    await useProposalStore.getState().fetchVersionDrafts(true);

    expect(useProposalStore.getState().versionDrafts).toHaveLength(0);
  });

  it("catches API errors silently (non-fatal — versionDrafts not cleared)", async () => {
    mockListProposals.mockRejectedValue(new Error("Network error"));

    // Should NOT throw
    await expect(useProposalStore.getState().fetchVersionDrafts(true)).resolves.toBeUndefined();
  });

  it("skips in-memory derivation when lastFetched is null (stale proposals)", async () => {
    useProposalStore.setState({
      proposals: mockProposals,
      isInitialized: true,
      lastFetched: null, // invalidated → must NOT use stale in-memory data
    });
    mockListProposals.mockResolvedValue([]);

    await useProposalStore.getState().fetchVersionDrafts(true);

    expect(mockListProposals).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// addVersionDraft / removeVersionDraft
// ---------------------------------------------------------------------------

describe("proposalSlice — addVersionDraft", () => {
  it("prepends a version draft and sets versionDraftsLastFetched", () => {
    const draft: ProposalListItem = { ...mockProposals[0], id: 700 };

    useProposalStore.getState().addVersionDraft(draft);

    const { versionDrafts, versionDraftsLastFetched } = useProposalStore.getState();
    expect(versionDrafts[0].id).toBe(700);
    expect(versionDraftsLastFetched).not.toBeNull();
  });

  it("prepends to existing list (keeps prior drafts)", () => {
    useProposalStore.setState({ versionDrafts: [{ ...mockProposals[0], id: 800 }] });
    const newDraft: ProposalListItem = { ...mockProposals[0], id: 801 };

    useProposalStore.getState().addVersionDraft(newDraft);

    const { versionDrafts } = useProposalStore.getState();
    expect(versionDrafts).toHaveLength(2);
    expect(versionDrafts[0].id).toBe(801); // newest first
  });
});

describe("proposalSlice — removeVersionDraft", () => {
  it("removes the version draft matching the given id", () => {
    useProposalStore.setState({
      versionDrafts: [
        { ...mockProposals[0], id: 901 },
        { ...mockProposals[0], id: 902 },
      ],
    });

    useProposalStore.getState().removeVersionDraft(901);

    const { versionDrafts } = useProposalStore.getState();
    expect(versionDrafts).toHaveLength(1);
    expect(versionDrafts[0].id).toBe(902);
  });

  it("leaves list unchanged when id is not found", () => {
    useProposalStore.setState({
      versionDrafts: [{ ...mockProposals[0], id: 999 }],
    });

    useProposalStore.getState().removeVersionDraft(0);

    expect(useProposalStore.getState().versionDrafts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// fetchProposalHistory — error branch
// ---------------------------------------------------------------------------

describe("proposalSlice — fetchProposalHistory error handling", () => {
  it("sets error message and rethrows on API failure", async () => {
    mockListProposalHistory.mockRejectedValue(new Error("History fetch failed"));

    await expect(useProposalStore.getState().fetchProposalHistory(true)).rejects.toThrow(
      "History fetch failed"
    );

    expect(useProposalStore.getState().error).toBe("History fetch failed");
    expect(useProposalStore.getState().isLoading).toBe(false);
  });

  it("uses generic error message for non-Error thrown value", async () => {
    mockListProposalHistory.mockRejectedValue("string error");

    await expect(useProposalStore.getState().fetchProposalHistory(true)).rejects.toBe(
      "string error"
    );

    expect(useProposalStore.getState().error).toBe("Failed to fetch proposal history");
  });
});

// ---------------------------------------------------------------------------
// fetchMoreProposals — error branch
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// fetchProposalHistory — isLoading guard (line 216) and reset (line 334)
// ---------------------------------------------------------------------------

describe("proposalSlice — fetchProposalHistory isLoading guard (line 216)", () => {
  it("returns early without fetching when isLoading is already true", async () => {
    useProposalStore.setState({ isLoading: true });
    await useProposalStore.getState().fetchProposalHistory(true);
    expect(mockListProposalHistory).not.toHaveBeenCalled();
  });
});

describe("proposalSlice — reset (line 334)", () => {
  it("resets all state to initial values", () => {
    useProposalStore.setState({
      proposals: [{ id: 1 } as import("@/interfaces/proposalInterfaces").ProposalListItem],
      isLoading: true,
      isInitialized: true,
    });
    useProposalStore.getState().reset();
    expect(useProposalStore.getState().proposals).toEqual([]);
    expect(useProposalStore.getState().isLoading).toBe(false);
    expect(useProposalStore.getState().isInitialized).toBe(false);
  });
});

describe("proposalSlice — fetchMoreProposals error handling", () => {
  it("sets error message and rethrows on API failure", async () => {
    useProposalStore.setState({ hasMore: true, page: 1, pageSize: 20 });
    mockListProposals.mockRejectedValue(new Error("Load more failed"));

    await expect(useProposalStore.getState().fetchMoreProposals()).rejects.toThrow(
      "Load more failed"
    );

    expect(useProposalStore.getState().error).toBe("Load more failed");
    expect(useProposalStore.getState().isLoadingMore).toBe(false);
  });

  it("uses generic error message when non-Error is thrown in fetchMoreProposals", async () => {
    useProposalStore.setState({ hasMore: true, page: 1, pageSize: 20 });
    mockListProposals.mockRejectedValue("network down");

    await expect(useProposalStore.getState().fetchMoreProposals()).rejects.toBe("network down");

    expect(useProposalStore.getState().error).toBe("Failed to load more proposals");
  });
});
