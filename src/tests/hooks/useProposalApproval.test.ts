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
