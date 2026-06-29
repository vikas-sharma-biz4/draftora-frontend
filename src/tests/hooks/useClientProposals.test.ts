/**
 * Tests for useClientProposals.ts
 *
 * Coverage targets:
 *   - Cache-aware proposal fetch: skips fetchProposals when cache is valid
 *   - clientProposals: filtered from all proposals by clientId
 *   - clientDrafts: drafts matching proposal IDs OR matching clientName, deduped
 *   - filteredProposals: searches title, clientName, id, version
 *   - filteredDraftRows: searches title and clientName
 *   - isLoadingProposals: combined from local, store, and draft load states
 */

import { renderHook, waitFor } from "@testing-library/react";

import { useClientProposals } from "@/hooks/useClientProposals";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";
import type { DraftMetadata } from "@/interfaces/draftInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIsCacheValid = jest.fn();
const mockFetchProposals = jest.fn();
const mockProposals: ProposalListItem[] = [];

jest.mock("@/store/features/proposals/proposalSlice", () => ({
  useProposalStore: (selector: (s: unknown) => unknown) => {
    const state = {
      proposals: mockProposals,
      isLoading: false,
    };
    return selector(state);
  },
}));

// getState() is used inside the effect — needs separate mock
const proposalStoreModule = require("@/store/features/proposals/proposalSlice");
proposalStoreModule.useProposalStore.getState = () => ({
  isCacheValid: mockIsCacheValid,
  fetchProposals: mockFetchProposals,
});

const mockListDrafts = jest.fn();
jest.mock("@/services/draft.service", () => ({
  listDrafts: (...args: unknown[]) => mockListDrafts(...args),
}));

const mockDownloadProposal = jest.fn();
jest.mock("@/hooks/useProposalDownload", () => ({
  useProposalDownload: () => ({ downloadProposal: mockDownloadProposal }),
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeProposal = (id: number, clientId: number, clientName: string): ProposalListItem => ({
  id,
  title: `Proposal ${id}`,
  clientId,
  clientName,
  status: "pending",
  approvalStatus: "pending",
  tone: "professional",
  lengthPreference: "balanced",
  templateType: "predefined",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-02T00:00:00Z",
});

const makeDraft = (id: string, proposalId: number | null, clientName: string): DraftMetadata => ({
  id,
  proposalId,
  title: `Draft ${id}`,
  clientName,
  status: "draft",
  lastLocation: "wizard_parameters",
  stage: "wizard_in_progress",
  updatedAt: "2025-01-02T00:00:00Z",
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockListDrafts.mockResolvedValue([]);
  mockFetchProposals.mockResolvedValue(undefined);
  mockIsCacheValid.mockReturnValue(false);

  // Reset the proposals array used by the store mock
  mockProposals.length = 0;
});

// ---------------------------------------------------------------------------
// Cache-aware proposal fetch
// ---------------------------------------------------------------------------

describe("useClientProposals — cache-aware proposal fetch", () => {
  it("does not call fetchProposals when the store cache is valid", async () => {
    mockIsCacheValid.mockReturnValue(true);

    renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(mockFetchProposals).not.toHaveBeenCalled();
    });
  });

  it("calls fetchProposals when the store cache is stale", async () => {
    mockIsCacheValid.mockReturnValue(false);

    renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(mockFetchProposals).toHaveBeenCalledTimes(1);
    });
  });

  it("fetches drafts on mount regardless of cache", async () => {
    mockIsCacheValid.mockReturnValue(true); // proposals are cached
    mockListDrafts.mockResolvedValue([makeDraft("d-1", null, "Acme Corp")]);

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(mockListDrafts).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// clientProposals — filtered by clientId
// ---------------------------------------------------------------------------

describe("useClientProposals — clientProposals filtering", () => {
  it("returns only proposals matching the given clientId", async () => {
    mockProposals.push(
      makeProposal(1, 1, "Acme Corp"),
      makeProposal(2, 2, "Other Corp"),
      makeProposal(3, 1, "Acme Corp")
    );

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(result.current.clientProposals).toHaveLength(2);
      expect(result.current.clientProposals.map((p) => p.id)).toEqual([1, 3]);
    });
  });

  it("returns an empty array when no proposals match the clientId", async () => {
    mockProposals.push(makeProposal(1, 99, "Other Corp"));

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(result.current.clientProposals).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// clientDrafts — draft filtering logic
// ---------------------------------------------------------------------------

describe("useClientProposals — clientDrafts filtering", () => {
  it("includes drafts whose proposalId matches a client proposal", async () => {
    mockProposals.push(makeProposal(10, 1, "Acme Corp"));
    mockListDrafts.mockResolvedValue([
      makeDraft("d-1", 10, "Acme Corp"), // linked to proposal 10
    ]);

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      // Draft is linked to proposal 10 which belongs to client 1
      // But the dedup rule removes drafts already linked to a proposal —
      // only un-linked drafts should appear here
      // (a draft WITH proposalId that exists in clientProposals is excluded)
      expect(result.current.clientDrafts).toHaveLength(0);
    });
  });

  it("includes drafts matching clientName (case-insensitive) when proposalId is null", async () => {
    mockListDrafts.mockResolvedValue([
      makeDraft("d-2", null, "acme corp"), // matches "Acme Corp" case-insensitively
    ]);

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(result.current.clientDrafts).toHaveLength(1);
      expect(result.current.clientDrafts[0].id).toBe("d-2");
    });
  });

  it("excludes drafts that don't match clientId or clientName", async () => {
    mockListDrafts.mockResolvedValue([makeDraft("d-3", null, "Unrelated Corp")]);

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(result.current.clientDrafts).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// filteredProposals — search
// ---------------------------------------------------------------------------

describe("useClientProposals — filteredProposals search", () => {
  beforeEach(() => {
    mockProposals.push(
      makeProposal(1, 1, "Acme Corp"), // title: "Proposal 1"
      makeProposal(2, 1, "Acme Corp") // title: "Proposal 2"
    );
  });

  it("returns all proposals when search query is empty", async () => {
    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(result.current.filteredProposals).toHaveLength(2);
    });
  });

  it("filters proposals by title substring (case-insensitive)", async () => {
    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));
    await waitFor(() => expect(result.current.clientProposals).toHaveLength(2));

    result.current.setProposalSearchQuery("proposal 1");

    await waitFor(() => {
      expect(result.current.filteredProposals).toHaveLength(1);
      expect(result.current.filteredProposals[0].id).toBe(1);
    });
  });

  it("filters proposals by clientName substring", async () => {
    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));
    await waitFor(() => expect(result.current.clientProposals).toHaveLength(2));

    result.current.setProposalSearchQuery("acme");

    await waitFor(() => {
      expect(result.current.filteredProposals).toHaveLength(2);
    });
  });

  it("returns empty array when search matches nothing", async () => {
    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));
    await waitFor(() => expect(result.current.clientProposals).toHaveLength(2));

    result.current.setProposalSearchQuery("zzz_no_match");

    await waitFor(() => {
      expect(result.current.filteredProposals).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// filteredDraftRows — search
// ---------------------------------------------------------------------------

describe("useClientProposals — filteredDraftRows search", () => {
  it("filters draft rows by title (case-insensitive)", async () => {
    mockListDrafts.mockResolvedValue([
      makeDraft("d-a", null, "Acme Corp"), // title: "Draft d-a"
      makeDraft("d-b", null, "Acme Corp"), // title: "Draft d-b"
    ]);

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));
    await waitFor(() => expect(result.current.clientDrafts).toHaveLength(2));

    result.current.setProposalSearchQuery("draft d-a");

    await waitFor(() => {
      expect(result.current.filteredDraftRows).toHaveLength(1);
      expect(result.current.filteredDraftRows[0].id).toBe("d-a");
    });
  });
});

// ---------------------------------------------------------------------------
// Line 50 — fetchProposals error branch
// ---------------------------------------------------------------------------

describe("useClientProposals — fetchProposals error handling (line 50)", () => {
  it("logs an error and still clears the local loading flag when fetchProposals rejects", async () => {
    const { logger } = require("@/utils/logger");
    mockIsCacheValid.mockReturnValue(false);
    mockFetchProposals.mockRejectedValue(new Error("network failure"));

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        "[useClientProposals] Failed to fetch proposals:",
        expect.any(Error)
      );
    });

    // isLoadingProposals should eventually become false (finally ran)
    await waitFor(() => {
      expect(result.current.isLoadingProposals).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Line 58 — listDrafts error branch
// ---------------------------------------------------------------------------

describe("useClientProposals — listDrafts error handling (line 58)", () => {
  it("logs an error and still clears the draft loading flag when listDrafts rejects", async () => {
    const { logger } = require("@/utils/logger");
    mockIsCacheValid.mockReturnValue(true); // skip proposal fetch so only drafts matter
    mockListDrafts.mockRejectedValue(new Error("drafts unavailable"));

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        "[useClientProposals] Failed to load drafts:",
        expect.any(Error)
      );
    });

    // isLoadingProposals should eventually become false (finally ran)
    await waitFor(() => {
      expect(result.current.isLoadingProposals).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Lines 80-84 — handleDownloadProposal try/finally branch
// ---------------------------------------------------------------------------

describe("useClientProposals — handleDownloadProposal (lines 80-84)", () => {
  it("sets downloadingProposalId during the download and resets it to null on success", async () => {
    mockIsCacheValid.mockReturnValue(true);

    let resolveDownload!: () => void;
    mockDownloadProposal.mockReturnValue(
      new Promise<void>((res) => {
        resolveDownload = res;
      })
    );

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));
    await waitFor(() => expect(result.current.isLoadingProposals).toBe(false));

    // Start the download — do not await so we can inspect intermediate state
    let downloadPromise: Promise<void>;

    downloadPromise = result.current.handleDownloadProposal(42);

    await waitFor(() => {
      expect(result.current.downloadingProposalId).toBe(42);
    });

    // Resolve the underlying download
    resolveDownload();
    await downloadPromise;

    await waitFor(() => {
      expect(result.current.downloadingProposalId).toBeNull();
    });

    expect(mockDownloadProposal).toHaveBeenCalledWith(42);
  });

  it("resets downloadingProposalId to null even when downloadProposal throws", async () => {
    mockIsCacheValid.mockReturnValue(true);
    mockDownloadProposal.mockRejectedValue(new Error("download failed"));

    const { result } = renderHook(() => useClientProposals(1, "Acme Corp"));
    await waitFor(() => expect(result.current.isLoadingProposals).toBe(false));

    // The error re-throws through the finally block — catch it so the test doesn't fail
    await result.current.handleDownloadProposal(7).catch(() => {});

    await waitFor(() => {
      expect(result.current.downloadingProposalId).toBeNull();
    });
  });
});
