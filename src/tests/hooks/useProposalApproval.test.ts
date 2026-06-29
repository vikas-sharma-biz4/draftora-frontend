/**
 * Tests for useProposalApproval hook
 *
 * Coverage targets:
 *   - Initial state (isApproving, isRejecting false)
 *   - handleApprove: calls updateApprovalStatus, deleteDraft, shows toast, redirects
 *   - handleApprove: removes draft with hasEdits=true → version "v2"
 *   - handleApprove: removes draft with hasEdits=false → version "v1"
 *   - handleApprove: re-throws on API failure, shows error toast
 *   - handleReject: calls updateApprovalStatus with "rejected", shows toast
 *   - handleReject: re-throws on API failure
 *   - handleDownload: delegates to useProposalDownload
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useProposalApproval } from "@/hooks/useProposalApproval";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Stable download mock across all hook invocations
const mockDownloadProposal = jest.fn().mockResolvedValue(undefined);
jest.mock("@/hooks/useProposalDownload", () => ({
  useProposalDownload: () => ({
    isDownloading: false,
    downloadProposal: mockDownloadProposal,
  }),
}));

jest.mock("@/services/proposal", () => ({
  updateApprovalStatus: jest.fn(),
}));

jest.mock("@/services/draft.service", () => ({
  getDraftByProposalId: jest.fn(),
  deleteDraft: jest.fn(),
}));

jest.mock("@/utils/proposalVersionCache", () => ({
  setProposalHistoryVersion: jest.fn(),
}));

jest.mock("@/utils/toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/constants/messages", () => ({
  MESSAGES: {
    PROPOSAL_APPROVED: "Proposal approved and moved to history",
    PROPOSAL_REJECTED: "Proposal rejected and moved to history",
    PROPOSAL_APPROVE_FAILED: "Failed to approve proposal",
    PROPOSAL_REJECT_FAILED: "Failed to reject proposal",
    PROPOSAL_CACHE_STALE: "Approval succeeded. Changes may take a moment to reflect.",
  },
}));

import * as proposalService from "@/services/proposal";
import * as draftService from "@/services/draft.service";
import * as proposalVersionCache from "@/utils/proposalVersionCache";

const mockUpdateApprovalStatus = proposalService.updateApprovalStatus as jest.Mock;
const mockGetDraftByProposalId = draftService.getDraftByProposalId as jest.Mock;
const mockDeleteDraft = draftService.deleteDraft as jest.Mock;
const mockSetProposalHistoryVersion = proposalVersionCache.setProposalHistoryVersion as jest.Mock;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUpdateApprovalStatus.mockResolvedValue(undefined);
  mockGetDraftByProposalId.mockResolvedValue(null);
  mockDeleteDraft.mockResolvedValue(undefined);
  mockDownloadProposal.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.runAllTimers();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useProposalApproval — initial state", () => {
  it("isApproving and isRejecting start as false", () => {
    const { result } = renderHook(() => useProposalApproval({ proposalId: 1 }));
    expect(result.current.isApproving).toBe(false);
    expect(result.current.isRejecting).toBe(false);
  });
});

describe("useProposalApproval — handleApprove", () => {
  it("calls updateApprovalStatus with 'approved'", async () => {
    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    act(() => {
      void result.current.handleApprove();
    });
    act(() => jest.runAllTimers());

    await waitFor(() => {
      expect(mockUpdateApprovalStatus).toHaveBeenCalledWith(5, "approved");
    });
  });

  it("shows success toast", async () => {
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { success: jest.Mock } };
    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    act(() => {
      void result.current.handleApprove();
    });
    act(() => jest.runAllTimers());

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Proposal approved and moved to history");
    });
  });

  it("redirects to /history after approval", async () => {
    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    act(() => {
      void result.current.handleApprove();
    });
    act(() => jest.runAllTimers());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/history");
    });
  });

  it("sets version to v2 when draft hasEdits=true", async () => {
    mockGetDraftByProposalId.mockResolvedValue({ id: "d1", hasEdits: true });
    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    act(() => {
      void result.current.handleApprove();
    });
    act(() => jest.runAllTimers());

    await waitFor(() => {
      expect(mockSetProposalHistoryVersion).toHaveBeenCalledWith(5, "v2");
    });
    expect(mockDeleteDraft).toHaveBeenCalledWith("d1");
  });

  it("sets version to v1 when draft hasEdits=false", async () => {
    mockGetDraftByProposalId.mockResolvedValue({ id: "d2", hasEdits: false });
    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    act(() => {
      void result.current.handleApprove();
    });
    act(() => jest.runAllTimers());

    await waitFor(() => {
      expect(mockSetProposalHistoryVersion).toHaveBeenCalledWith(5, "v1");
    });
  });

  it("calls onApprovalSuccess callback with 'approved'", async () => {
    const onApprovalSuccess = jest.fn();
    const { result } = renderHook(() => useProposalApproval({ proposalId: 5, onApprovalSuccess }));

    act(() => {
      void result.current.handleApprove();
    });
    act(() => jest.runAllTimers());

    await waitFor(() => {
      expect(onApprovalSuccess).toHaveBeenCalledWith("approved");
    });
  });

  it("shows error toast and resets isApproving on API failure", async () => {
    jest.useRealTimers();
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { error: jest.Mock } };
    mockUpdateApprovalStatus.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.handleApprove();
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError?.message).toBe("Server error");
    expect(toast.error).toHaveBeenCalled();
    expect(result.current.isApproving).toBe(false);

    jest.useFakeTimers();
  });
});

describe("useProposalApproval — handleReject", () => {
  it("calls updateApprovalStatus with 'rejected'", async () => {
    const { result } = renderHook(() => useProposalApproval({ proposalId: 7 }));

    act(() => {
      void result.current.handleReject();
    });
    act(() => jest.runAllTimers());

    await waitFor(() => {
      expect(mockUpdateApprovalStatus).toHaveBeenCalledWith(7, "rejected");
    });
  });

  it("shows rejected success toast", async () => {
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { success: jest.Mock } };
    const { result } = renderHook(() => useProposalApproval({ proposalId: 7 }));

    act(() => {
      void result.current.handleReject();
    });
    act(() => jest.runAllTimers());

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Proposal rejected and moved to history");
    });
  });

  it("re-throws error on reject API failure", async () => {
    jest.useRealTimers();
    mockUpdateApprovalStatus.mockRejectedValue(new Error("Reject failed"));

    const { result } = renderHook(() => useProposalApproval({ proposalId: 7 }));

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.handleReject();
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError?.message).toBe("Reject failed");
    jest.useFakeTimers();
  });
});

describe("useProposalApproval — handleDownload", () => {
  it("delegates to downloadProposal with the proposalId", async () => {
    const { result } = renderHook(() => useProposalApproval({ proposalId: 9 }));

    await act(async () => {
      await result.current.handleDownload();
    });

    expect(mockDownloadProposal).toHaveBeenCalledWith(9);
  });
});

// ---------------------------------------------------------------------------
// Additional branches: AbortSignal, onCacheInvalidate, draftError, non-Error
// ---------------------------------------------------------------------------

describe("useProposalApproval — AbortSignal already aborted before API call", () => {
  it("returns immediately without calling updateApprovalStatus", async () => {
    jest.useRealTimers();
    const controller = new AbortController();
    controller.abort(); // already aborted

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    await act(async () => {
      await result.current.executeApprovalAction("approve", controller.signal);
    });

    expect(mockUpdateApprovalStatus).not.toHaveBeenCalled();
    jest.useFakeTimers();
  });
});

describe("useProposalApproval — AbortSignal aborted after API call", () => {
  it("returns without proceeding to draft cleanup", async () => {
    jest.useRealTimers();
    const controller = new AbortController();

    mockUpdateApprovalStatus.mockImplementation(async () => {
      controller.abort(); // abort mid-flight, right after the API resolves
    });

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    await act(async () => {
      await result.current.executeApprovalAction("approve", controller.signal);
    });

    // Aborted after API call → draft step skipped
    expect(mockGetDraftByProposalId).not.toHaveBeenCalled();
    jest.useFakeTimers();
  });
});

describe("useProposalApproval — draftError catch (getDraftByProposalId throws)", () => {
  it("catches the error silently and continues to show success toast", async () => {
    jest.useRealTimers();
    const { toast } = jest.requireMock("@/utils/toast") as {
      toast: { success: jest.Mock };
    };
    mockGetDraftByProposalId.mockRejectedValue(new Error("Draft fetch failed"));

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    // Should NOT re-throw (draftError is caught internally)
    await act(async () => {
      await result.current.handleApprove();
    });

    expect(mockDeleteDraft).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Proposal approved and moved to history");
    jest.useFakeTimers();
  });

  it("uses v1 when draft hasEdits is null (falsy via ?? false)", async () => {
    jest.useRealTimers();
    mockGetDraftByProposalId.mockResolvedValue({ id: "d-null", hasEdits: null });

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    await act(async () => {
      await result.current.handleApprove();
    });

    expect(mockSetProposalHistoryVersion).toHaveBeenCalledWith(5, "v1");
    jest.useFakeTimers();
  });
});

describe("useProposalApproval — onCacheInvalidate throws (toast.warning branch)", () => {
  it("shows toast.warning when onCacheInvalidate throws, then continues", async () => {
    jest.useRealTimers();
    const { toast } = jest.requireMock("@/utils/toast") as {
      toast: { success: jest.Mock; warning: jest.Mock };
    };
    const onCacheInvalidate = jest.fn().mockImplementation(() => {
      throw new Error("Cache invalidation failed");
    });

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5, onCacheInvalidate }));

    await act(async () => {
      await result.current.handleApprove();
    });

    expect(toast.warning).toHaveBeenCalled();
    // Success flow continues despite cache error
    expect(toast.success).toHaveBeenCalledWith("Proposal approved and moved to history");
    jest.useFakeTimers();
  });
});

describe("useProposalApproval — AbortError swallowed silently", () => {
  it("does not show error toast or re-throw when AbortError is thrown", async () => {
    jest.useRealTimers();
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { error: jest.Mock } };
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockUpdateApprovalStatus.mockRejectedValue(abortError);

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    // Should NOT throw (AbortError is swallowed)
    await act(async () => {
      await result.current.handleApprove();
    });

    expect(toast.error).not.toHaveBeenCalled();
    jest.useFakeTimers();
  });
});

describe("useProposalApproval — non-Error thrown value (message fallback)", () => {
  it("uses PROPOSAL_REJECT_FAILED message when non-Error is thrown during reject", async () => {
    jest.useRealTimers();
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { error: jest.Mock } };
    mockUpdateApprovalStatus.mockRejectedValue("string error"); // non-Error

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    await act(async () => {
      try {
        await result.current.handleReject();
      } catch {
        // expected re-throw
      }
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to reject proposal");
    jest.useFakeTimers();
  });

  it("uses PROPOSAL_APPROVE_FAILED message when non-Error is thrown during approve", async () => {
    jest.useRealTimers();
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { error: jest.Mock } };
    mockUpdateApprovalStatus.mockRejectedValue(42); // non-Error

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    await act(async () => {
      try {
        await result.current.handleApprove();
      } catch {
        // expected re-throw
      }
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to approve proposal");
    jest.useFakeTimers();
  });
});

// ---------------------------------------------------------------------------
// AbortSignal line 76 — aborted after draft cleanup
// ---------------------------------------------------------------------------

describe("useProposalApproval — AbortSignal aborted during draft delete (line 76)", () => {
  it("returns early after draft cleanup without calling onApprovalSuccess", async () => {
    jest.useRealTimers();
    const controller = new AbortController();
    const onApprovalSuccess = jest.fn();

    // Abort the signal during deleteDraft (after getDraftByProposalId)
    mockGetDraftByProposalId.mockResolvedValue({ id: "d1", hasEdits: false });
    mockDeleteDraft.mockImplementation(async () => {
      controller.abort();
    });

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5, onApprovalSuccess }));

    await act(async () => {
      await result.current.executeApprovalAction("approve", controller.signal);
    });

    // Line 76 true branch: signal aborted → return early → onApprovalSuccess not called
    expect(onApprovalSuccess).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    jest.useFakeTimers();
  });
});

// ---------------------------------------------------------------------------
// AbortSignal line 93 — aborted after setTimeout
// ---------------------------------------------------------------------------

describe("useProposalApproval — AbortSignal aborted after setTimeout (line 93)", () => {
  it("returns early after delay without calling router.push", async () => {
    jest.useFakeTimers();
    const controller = new AbortController();

    mockGetDraftByProposalId.mockResolvedValue(null);

    const { result } = renderHook(() => useProposalApproval({ proposalId: 5 }));

    let actionPromise: Promise<void>;
    act(() => {
      actionPromise = result.current.executeApprovalAction("approve", controller.signal);
    });

    // Abort while the 500ms setTimeout is pending
    act(() => {
      controller.abort();
      jest.runAllTimers();
    });

    await act(async () => {
      await actionPromise!;
    });

    // Line 93 true branch: signal aborted after timeout → no router.push
    expect(mockPush).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
