/**
 * Tests for src/hooks/useVersionDraft.ts
 *
 * Coverage targets:
 *   - returns initial state { isCreating: false, draftId: null }
 *   - calls createVersionDraft with the correct parentProposalId and trigger
 *   - returns the new draft id on success
 *   - sets draftId state to the new id
 *   - calls addVersionDraft with a correctly shaped ProposalListItem
 *   - calls invalidateCache after the store is updated
 *   - navigates to /proposal/{newId} on success
 *   - resets isCreating to false after success
 *   - shows toast.error with the error message on failure
 *   - returns null on failure
 *   - resets isCreating to false after failure
 *   - does not call addVersionDraft or invalidateCache on failure
 *   - uses a generic message when the thrown value has no message property
 */

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/services/proposal", () => ({
  createVersionDraft: jest.fn(),
}));

jest.mock("@/store/features/proposals/proposalSlice", () => ({
  useProposalStore: jest.fn(),
}));

jest.mock("@/utils/toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { act, renderHook } from "@testing-library/react";
import { useVersionDraft } from "@/hooks/useVersionDraft";
import { useRouter } from "next/navigation";
import * as proposalService from "@/services/proposal";
import { useProposalStore } from "@/store/features/proposals/proposalSlice";
import { toast } from "@/utils/toast";

// ---------------------------------------------------------------------------
// Shared mock setup
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockAddVersionDraft = jest.fn();
const mockInvalidateCache = jest.fn();
const mockCreateVersionDraft = proposalService.createVersionDraft as jest.Mock;

const fakeDraft = {
  id: 42,
  title: "My Proposal v1.1",
  status: "draft",
  approvalStatus: "pending",
  versionLabel: "1.1",
  parentProposalId: 10,
  rootProposalId: 10,
  createdAt: "2026-06-18T12:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  (useProposalStore as jest.Mock).mockImplementation((selector: (s: object) => unknown) =>
    selector({ addVersionDraft: mockAddVersionDraft, invalidateCache: mockInvalidateCache })
  );
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("useVersionDraft — initial state", () => {
  it("returns isCreating as false before any call", () => {
    const { result } = renderHook(() => useVersionDraft(10));
    expect(result.current.isCreating).toBe(false);
  });

  it("returns draftId as null before any call", () => {
    const { result } = renderHook(() => useVersionDraft(10));
    expect(result.current.draftId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Successful version draft creation
// ---------------------------------------------------------------------------

describe("useVersionDraft — triggerVersionDraft success", () => {
  it("calls createVersionDraft with the correct parentProposalId and trigger", async () => {
    mockCreateVersionDraft.mockResolvedValueOnce(fakeDraft);
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("section_edit");
    });

    expect(mockCreateVersionDraft).toHaveBeenCalledWith(10, "section_edit");
    expect(mockCreateVersionDraft).toHaveBeenCalledTimes(1);
  });

  it("returns the new draft id", async () => {
    mockCreateVersionDraft.mockResolvedValueOnce(fakeDraft);
    const { result } = renderHook(() => useVersionDraft(10));

    let returnedId: number | null = null;
    await act(async () => {
      returnedId = await result.current.triggerVersionDraft("section_edit");
    });

    expect(returnedId).toBe(42);
  });

  it("sets draftId state to the new id", async () => {
    mockCreateVersionDraft.mockResolvedValueOnce(fakeDraft);
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("section_edit");
    });

    expect(result.current.draftId).toBe(42);
  });

  it("calls addVersionDraft with a correctly shaped ProposalListItem", async () => {
    mockCreateVersionDraft.mockResolvedValueOnce(fakeDraft);
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("section_edit");
    });

    expect(mockAddVersionDraft).toHaveBeenCalledTimes(1);
    expect(mockAddVersionDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
        title: "My Proposal v1.1",
        versionLabel: "1.1",
        parentProposalId: 10,
        rootProposalId: 10,
        approvalStatus: "pending",
        status: "draft",
      })
    );
  });

  it("calls invalidateCache to force the draft list to refetch", async () => {
    mockCreateVersionDraft.mockResolvedValueOnce(fakeDraft);
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("section_edit");
    });

    expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
  });

  it("navigates to /proposal/{newId}", async () => {
    mockCreateVersionDraft.mockResolvedValueOnce(fakeDraft);
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("section_edit");
    });

    expect(mockPush).toHaveBeenCalledWith("/proposal/42");
  });

  it("resets isCreating to false after success", async () => {
    mockCreateVersionDraft.mockResolvedValueOnce(fakeDraft);
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("section_edit");
    });

    expect(result.current.isCreating).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("useVersionDraft — triggerVersionDraft error", () => {
  it("shows toast.error with the error message", async () => {
    mockCreateVersionDraft.mockRejectedValueOnce(new Error("API unavailable"));
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("duplicate");
    });

    expect((toast as { error: jest.Mock }).error).toHaveBeenCalledWith("API unavailable");
  });

  it("returns null on failure", async () => {
    mockCreateVersionDraft.mockRejectedValueOnce(new Error("API unavailable"));
    const { result } = renderHook(() => useVersionDraft(10));

    let returnedId: number | null | undefined;
    await act(async () => {
      returnedId = await result.current.triggerVersionDraft("duplicate");
    });

    expect(returnedId).toBeNull();
  });

  it("resets isCreating to false after failure", async () => {
    mockCreateVersionDraft.mockRejectedValueOnce(new Error("API unavailable"));
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("duplicate");
    });

    expect(result.current.isCreating).toBe(false);
  });

  it("does not call addVersionDraft or invalidateCache on failure", async () => {
    mockCreateVersionDraft.mockRejectedValueOnce(new Error("fail"));
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("restore");
    });

    expect(mockAddVersionDraft).not.toHaveBeenCalled();
    expect(mockInvalidateCache).not.toHaveBeenCalled();
  });

  it("uses a generic fallback message when the thrown value has no message property", async () => {
    mockCreateVersionDraft.mockRejectedValueOnce("plain string error");
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("duplicate");
    });

    expect((toast as { error: jest.Mock }).error).toHaveBeenCalledWith(
      "Failed to create version draft."
    );
  });

  it("does not navigate on failure", async () => {
    mockCreateVersionDraft.mockRejectedValueOnce(new Error("fail"));
    const { result } = renderHook(() => useVersionDraft(10));

    await act(async () => {
      await result.current.triggerVersionDraft("section_edit");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
