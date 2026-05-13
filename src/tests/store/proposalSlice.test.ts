/**
 * Tests for proposalSlice Zustand store
 *
 * Coverage targets:
 *   - Cache TTL validation (isCacheValid)
 *   - Concurrent fetch prevention (isLoading guard)
 *   - Cache invalidation
 *   - Computed selectors (getApproved, getRejected, getPending, getHistory)
 *   - CRUD operations (add, update, remove, set)
 *   - Error handling on fetch failure
 */

import { useProposalStore } from "@/store/features/proposals/proposalSlice";
import * as proposalApi from "@/services/proposal.service";
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
    lengthPreference: "detailed",
    templateType: "scratch",
    createdAt: "2025-01-03T00:00:00Z",
    updatedAt: "2025-01-03T00:00:00Z",
  },
];

jest.mock("@/services/proposal.service", () => ({
  listProposals: jest.fn(),
}));

const mockListProposals = proposalApi.listProposals as jest.Mock;

// Reset store between tests
beforeEach(() => {
  useProposalStore.setState({
    proposals: [],
    isLoading: false,
    isInitialized: false,
    lastFetched: null,
    error: null,
  });
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("proposalSlice — initial state", () => {
  it("starts with empty proposals array", () => {
    expect(useProposalStore.getState().proposals).toEqual([]);
  });

  it("starts with isLoading false", () => {
    expect(useProposalStore.getState().isLoading).toBe(false);
  });

  it("starts with isInitialized false", () => {
    expect(useProposalStore.getState().isInitialized).toBe(false);
  });

  it("starts with lastFetched null", () => {
    expect(useProposalStore.getState().lastFetched).toBeNull();
  });

  it("starts with error null", () => {
    expect(useProposalStore.getState().error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isCacheValid
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
      lastFetched: Date.now() - 60_000, // 1 minute ago
    });
    expect(useProposalStore.getState().isCacheValid()).toBe(true);
  });

  it("returns false when lastFetched is beyond TTL (3 minutes)", () => {
    useProposalStore.setState({
      isInitialized: true,
      lastFetched: Date.now() - 4 * 60_000, // 4 minutes ago
    });
    expect(useProposalStore.getState().isCacheValid()).toBe(false);
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

  it("sets error on API failure", async () => {
    mockListProposals.mockRejectedValue(new Error("Network error"));

    await expect(
      useProposalStore.getState().fetchProposals(true)
    ).rejects.toThrow("Network error");

    expect(useProposalStore.getState().error).toBe("Network error");
    expect(useProposalStore.getState().isLoading).toBe(false);
  });

  it("sets generic error message on non-Error thrown", async () => {
    mockListProposals.mockRejectedValue("string error");

    await expect(
      useProposalStore.getState().fetchProposals(true)
    ).rejects.toBe("string error");

    expect(useProposalStore.getState().error).toBe("Failed to fetch proposals");
  });
});

// ---------------------------------------------------------------------------
// Computed selectors
// ---------------------------------------------------------------------------

describe("proposalSlice — computed selectors", () => {
  beforeEach(() => {
    useProposalStore.setState({ proposals: mockProposals });
  });

  it("getProposalById returns matching proposal", () => {
    const result = useProposalStore.getState().getProposalById(2);
    expect(result?.title).toBe("Beta Proposal");
  });

  it("getProposalById returns undefined for non-existent id", () => {
    expect(useProposalStore.getState().getProposalById(999)).toBeUndefined();
  });

  it("getApprovedProposals returns only approved", () => {
    const result = useProposalStore.getState().getApprovedProposals();
    expect(result).toHaveLength(1);
    expect(result[0].approvalStatus).toBe("approved");
  });

  it("getRejectedProposals returns only rejected", () => {
    const result = useProposalStore.getState().getRejectedProposals();
    expect(result).toHaveLength(1);
    expect(result[0].approvalStatus).toBe("rejected");
  });

  it("getPendingProposals returns only pending", () => {
    const result = useProposalStore.getState().getPendingProposals();
    expect(result).toHaveLength(1);
    expect(result[0].approvalStatus).toBe("pending");
  });

  it("getHistoryProposals returns approved + rejected", () => {
    const result = useProposalStore.getState().getHistoryProposals();
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

describe("proposalSlice — CRUD operations", () => {
  it("addProposal prepends to list", () => {
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

  it("updateProposal merges partial updates", () => {
    useProposalStore.setState({ proposals: mockProposals });

    useProposalStore.getState().updateProposal(1, { title: "Updated Alpha" });

    const proposal = useProposalStore.getState().getProposalById(1);
    expect(proposal?.title).toBe("Updated Alpha");
    expect(proposal?.clientName).toBe("Client A"); // unchanged
  });

  it("removeProposal removes by id", () => {
    useProposalStore.setState({ proposals: mockProposals });

    useProposalStore.getState().removeProposal(2);

    const { proposals } = useProposalStore.getState();
    expect(proposals).toHaveLength(2);
    expect(proposals.find((p) => p.id === 2)).toBeUndefined();
  });

  it("setProposals replaces entire list and marks initialized", () => {
    useProposalStore.getState().setProposals(mockProposals);

    const state = useProposalStore.getState();
    expect(state.proposals).toEqual(mockProposals);
    expect(state.isInitialized).toBe(true);
    expect(state.lastFetched).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// invalidateCache
// ---------------------------------------------------------------------------

describe("proposalSlice — invalidateCache", () => {
  it("resets lastFetched and isInitialized", () => {
    useProposalStore.setState({
      isInitialized: true,
      lastFetched: Date.now(),
    });

    useProposalStore.getState().invalidateCache();

    expect(useProposalStore.getState().lastFetched).toBeNull();
    expect(useProposalStore.getState().isInitialized).toBe(false);
  });
});
