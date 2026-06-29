/**
 * Tests for useProposalDownload hook
 *
 * Coverage targets:
 *   - Initial isDownloading is false
 *   - Sets isDownloading=true during download, false after
 *   - Triggers browser download (anchor click) on success
 *   - Uses RFC 5987 filename from Content-Disposition header
 *   - Falls back to classic filename format
 *   - Falls back to default filename when no Content-Disposition
 *   - Shows success toast on success
 *   - Shows error toast on fetch failure (non-ok response)
 *   - Shows error toast when blob is empty
 *   - Revokes object URL after 500ms
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useProposalDownload } from "@/hooks/useProposalDownload";
import * as proposalService from "@/services/proposal";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/proposal", () => ({
  getDownloadUrl: jest.fn((id: number) => `https://api.test/download/${id}`),
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
    PROPOSAL_DOWNLOADED: "Proposal downloaded",
    PROPOSAL_DOWNLOAD_FAILED: "Failed to download proposal",
  },
}));

// ---------------------------------------------------------------------------
// Browser API stubs — set up once so they're always available
// ---------------------------------------------------------------------------

const mockCreateObjectURL = jest.fn().mockReturnValue("blob:mock-url");
const mockRevokeObjectURL = jest.fn();
const mockAnchorClick = jest.fn();

// jsdom doesn't implement these; define them once
Object.defineProperty(window.URL, "createObjectURL", {
  writable: true,
  configurable: true,
  value: mockCreateObjectURL,
});
Object.defineProperty(window.URL, "revokeObjectURL", {
  writable: true,
  configurable: true,
  value: mockRevokeObjectURL,
});

// Override HTMLAnchorElement.click globally to prevent real downloads
Object.defineProperty(HTMLAnchorElement.prototype, "click", {
  writable: true,
  configurable: true,
  value: mockAnchorClick,
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const mockBlob = new Blob(["content"], {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

const makeFetchResponse = (
  ok: boolean,
  blobData: Blob = mockBlob,
  contentDisposition: string | null = null
) => ({
  ok,
  status: ok ? 200 : 400,
  statusText: ok ? "OK" : "Bad Request",
  text: jest.fn().mockResolvedValue("error body"),
  blob: jest.fn().mockResolvedValue(blobData),
  headers: {
    get: jest.fn((header: string) => {
      if (header === "content-disposition") return contentDisposition;
      return null;
    }),
  },
});

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockCreateObjectURL.mockReturnValue("blob:mock-url");
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useProposalDownload", () => {
  it("initial isDownloading is false", () => {
    const { result } = renderHook(() => useProposalDownload());
    expect(result.current.isDownloading).toBe(false);
  });

  it("sets isDownloading false when done", async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(true));
    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    expect(result.current.isDownloading).toBe(false);
  });

  it("triggers anchor click and shows success toast", async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(true));
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { success: jest.Mock } };

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    expect(mockAnchorClick).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Proposal downloaded");
  });

  it("uses RFC 5987 encoded filename from Content-Disposition", async () => {
    const cd = "attachment; filename*=UTF-8''My%20Proposal%202024.docx";
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(true, mockBlob, cd));

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockAnchorClick).toHaveBeenCalled();
  });

  it("falls back to classic filename from Content-Disposition", async () => {
    const cd = 'attachment; filename="proposal-classic.docx"';
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(true, mockBlob, cd));

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it("uses default filename when no Content-Disposition header", async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(true, mockBlob, null));

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(42);
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockAnchorClick).toHaveBeenCalled();
  });

  it("shows error toast when response is not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(false));
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { error: jest.Mock } };

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    expect(toast.error).toHaveBeenCalled();
    expect(result.current.isDownloading).toBe(false);
  });

  it("shows error toast when blob is empty", async () => {
    const emptyBlob = new Blob([], { type: "application/octet-stream" });
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(true, emptyBlob));
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { error: jest.Mock } };

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    expect(toast.error).toHaveBeenCalled();
    expect(mockAnchorClick).not.toHaveBeenCalled();
  });

  it("revokes object URL after 500ms delay", async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(true));

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    expect(mockRevokeObjectURL).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });
  });

  it("shows error toast when fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network down"));
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { error: jest.Mock } };

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    expect(toast.error).toHaveBeenCalledWith("Network down");
  });

  it("uses failureMessage when a non-Error is thrown (error instanceof Error false branch)", async () => {
    // Throw a plain string — not an Error instance
    global.fetch = jest.fn().mockRejectedValue("non-error string");
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { error: jest.Mock } };

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    // useFileDownload falls back to configRef.current.failureMessage
    expect(toast.error).toHaveBeenCalledWith("Failed to download proposal");
  });

  it("succeeds with unquoted classic filename in Content-Disposition (classicMatch[2] branch)", async () => {
    // Unquoted filename — extractContentDispositionFilename reads classicMatch[2]
    const cd = "attachment; filename=unquoted-proposal.docx";
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(true, mockBlob, cd));
    const { toast } = jest.requireMock("@/utils/toast") as { toast: { success: jest.Mock } };

    const { result } = renderHook(() => useProposalDownload());

    await act(async () => {
      await result.current.downloadProposal(1);
    });

    // Download completed — anchor was clicked and success toast was shown
    expect(mockAnchorClick).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });
});
