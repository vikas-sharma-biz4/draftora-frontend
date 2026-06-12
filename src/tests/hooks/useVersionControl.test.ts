/**
 * Tests for useVersionControl hook
 *
 * Coverage targets:
 *   - Initial state (null history, not loading)
 *   - loadHistory: fetches and sets versionHistory, currentVersion, selectedVersion
 *   - loadHistory: calls onVersionChange callback
 *   - loadHistory: sets error and calls onError on failure
 *   - loadHistory: no-op when proposalId is null
 *   - autoLoadHistory=true triggers loadHistory on mount
 *   - autoLoadHistory=false does not trigger loadHistory on mount
 *   - selectVersion: fetches full version and updates selectedVersion
 *   - selectVersion: no-op when versionHistory is null
 *   - selectVersion: sets error when version not found
 *   - acceptVersion: updates versionHistory.acceptedVersions
 *   - rejectVersion: updates versionHistory.rejectedVersions
 *   - isVersionAccepted / isVersionRejected utility methods
 *   - regenerateVersion: calls loadHistory after regenerating
 *   - saveEdits: calls loadHistory after saving
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useVersionControl } from "@/hooks/useVersionControl";
import * as versionService from "@/services/version.service";
import type { VersionHistory, ProposalVersion } from "@/interfaces/versionInterfaces";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/version.service", () => ({
  getVersionHistory: jest.fn(),
  getVersion: jest.fn(),
  updateVersionDecision: jest.fn(),
  regenerateFromVersion: jest.fn(),
  saveEditedVersion: jest.fn(),
}));

const mockGetVersionHistory = versionService.getVersionHistory as jest.Mock;
const mockGetVersion = versionService.getVersion as jest.Mock;
const mockUpdateVersionDecision = versionService.updateVersionDecision as jest.Mock;
const mockRegenerateFromVersion = versionService.regenerateFromVersion as jest.Mock;
const mockSaveEditedVersion = versionService.saveEditedVersion as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeVersion = (id: string, version: number, decision = "pending"): ProposalVersion => ({
  id,
  proposalId: 1,
  version,
  source: "generated",
  decision: decision as ProposalVersion["decision"],
  snapshot: {
    proposalData: {} as ProposalVersion["snapshot"]["proposalData"],
    generatedContent: {},
    sectionTypes: {},
    metadata: {
      aiModel: "gpt-4o",
      tone: "professional",
      lengthPreference: "balanced",
      language: "English - US",
      contextualInstructions: "",
    },
  },
  createdAt: new Date().toISOString(),
});

const v1 = makeVersion("v1-id", 1);
const v2 = makeVersion("v2-id", 2);

const mockHistory: VersionHistory = {
  proposalId: 1,
  currentVersion: 2,
  versions: [v1, v2],
  acceptedVersions: [],
  rejectedVersions: [],
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGetVersionHistory.mockResolvedValue(mockHistory);
  mockGetVersion.mockResolvedValue(v2);
  mockUpdateVersionDecision.mockResolvedValue({ ...v2, decision: "accepted" });
  mockRegenerateFromVersion.mockResolvedValue({ proposalId: 1, versionId: "v3-id" });
  mockSaveEditedVersion.mockResolvedValue({ ...v2, version: 3 });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useVersionControl — initial state", () => {
  it("starts with null history and not loading when proposalId is null", () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: null, autoLoadHistory: false })
    );
    expect(result.current.versionHistory).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe("useVersionControl — loadHistory", () => {
  it("loads version history and sets currentVersion / selectedVersion", async () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    expect(result.current.versionHistory).toEqual(mockHistory);
    expect(result.current.currentVersion).toEqual(v2);
    expect(result.current.selectedVersion).toEqual(v2);
    expect(result.current.isLoading).toBe(false);
  });

  it("calls onVersionChange callback with latest version", async () => {
    const onVersionChange = jest.fn();

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false, onVersionChange })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    expect(onVersionChange).toHaveBeenCalledWith(v2);
  });

  it("sets error and calls onError on failure", async () => {
    const onError = jest.fn();
    mockGetVersionHistory.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false, onError })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("is a no-op when proposalId is null", async () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: null, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    expect(mockGetVersionHistory).not.toHaveBeenCalled();
  });

  it("auto-loads history when autoLoadHistory=true", async () => {
    renderHook(() => useVersionControl({ proposalId: 1, autoLoadHistory: true }));

    await waitFor(() => {
      expect(mockGetVersionHistory).toHaveBeenCalledWith(1);
    });
  });

  it("does not auto-load when autoLoadHistory=false", () => {
    renderHook(() => useVersionControl({ proposalId: 1, autoLoadHistory: false }));

    expect(mockGetVersionHistory).not.toHaveBeenCalled();
  });
});

describe("useVersionControl — selectVersion", () => {
  it("fetches full version details and updates selectedVersion", async () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.selectVersion(1);
    });

    expect(mockGetVersion).toHaveBeenCalledWith("v1-id");
    expect(result.current.selectedVersion).toEqual(v2); // mock returns v2
  });

  it("is a no-op when versionHistory is null", async () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.selectVersion(1);
    });

    expect(mockGetVersion).not.toHaveBeenCalled();
  });

  it("sets error when version number not found in history", async () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.selectVersion(999);
    });

    expect(result.current.error?.message).toContain("999");
  });
});

describe("useVersionControl — acceptVersion non-Error rejection", () => {
  it("wraps non-Error throw in acceptVersion into a generic Error", async () => {
    mockUpdateVersionDecision.mockRejectedValue("plain string error");

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.acceptVersion("v2-id");
    });

    expect(result.current.error?.message).toBe("Failed to accept version");
  });
});

describe("useVersionControl — acceptVersion", () => {
  it("calls updateVersionDecision with 'accepted' and updates acceptedVersions", async () => {
    const updatedV2 = { ...v2, decision: "accepted" as const };
    mockUpdateVersionDecision.mockResolvedValue(updatedV2);

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.acceptVersion("v2-id");
    });

    expect(mockUpdateVersionDecision).toHaveBeenCalledWith({
      versionId: "v2-id",
      decision: "accepted",
    });
    expect(result.current.versionHistory?.acceptedVersions).toContain(2);
  });

  it("calls onDecisionUpdate callback", async () => {
    const onDecisionUpdate = jest.fn();

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false, onDecisionUpdate })
    );

    await act(async () => {
      await result.current.loadHistory();
      await result.current.acceptVersion("v2-id");
    });

    expect(onDecisionUpdate).toHaveBeenCalledWith("v2-id", "accepted");
  });
});

describe("useVersionControl — rejectVersion non-Error rejection", () => {
  it("wraps non-Error throw in rejectVersion into a generic Error", async () => {
    mockUpdateVersionDecision.mockRejectedValue("plain string error");

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.rejectVersion("v2-id");
    });

    expect(result.current.error?.message).toBe("Failed to reject version");
  });
});

describe("useVersionControl — rejectVersion", () => {
  it("calls updateVersionDecision with 'rejected' and updates rejectedVersions", async () => {
    const updatedV2 = { ...v2, decision: "rejected" as const };
    mockUpdateVersionDecision.mockResolvedValue(updatedV2);

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.rejectVersion("v2-id");
    });

    expect(result.current.versionHistory?.rejectedVersions).toContain(2);
  });
});

describe("useVersionControl — isVersionAccepted / isVersionRejected", () => {
  it("isVersionAccepted returns true for accepted version numbers", async () => {
    const accepted = { ...v2, decision: "accepted" as const };
    mockUpdateVersionDecision.mockResolvedValue(accepted);

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.acceptVersion("v2-id");
    });

    expect(result.current.isVersionAccepted(2)).toBe(true);
    expect(result.current.isVersionAccepted(1)).toBe(false);
  });

  it("isVersionRejected returns false when versionHistory is null", () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    expect(result.current.isVersionRejected(1)).toBe(false);
  });
});

describe("useVersionControl — regenerateVersion", () => {
  it("calls regenerateFromVersion and then reloads history", async () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    const callsBefore = mockGetVersionHistory.mock.calls.length;

    await act(async () => {
      await result.current.regenerateVersion("v2-id", { tone: "casual" });
    });

    expect(mockRegenerateFromVersion).toHaveBeenCalledWith({
      versionId: "v2-id",
      modifications: { tone: "casual" },
    });
    // loadHistory called again after regeneration
    expect(mockGetVersionHistory.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("sets error and re-throws on failure", async () => {
    mockRegenerateFromVersion.mockRejectedValue(new Error("Regen failed"));

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.regenerateVersion("v2-id", {});
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError?.message).toBe("Regen failed");
    expect(result.current.error?.message).toBe("Regen failed");
  });
});

describe("useVersionControl — saveEdits", () => {
  it("calls saveEditedVersion and then reloads history", async () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    const callsBefore = mockGetVersionHistory.mock.calls.length;

    await act(async () => {
      await result.current.saveEdits("v2-id", { intro: "New intro" });
    });

    expect(mockSaveEditedVersion).toHaveBeenCalledWith("v2-id", { intro: "New intro" });
    expect(mockGetVersionHistory.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe("useVersionControl — acceptVersion without history", () => {
  it("still calls API even when versionHistory is null", async () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    // versionHistory is null — should still call the API
    await act(async () => {
      await result.current.acceptVersion("v2-id");
    });

    expect(mockUpdateVersionDecision).toHaveBeenCalledWith({
      versionId: "v2-id",
      decision: "accepted",
    });
  });
});

describe("useVersionControl — rejectVersion without history", () => {
  it("still calls API even when versionHistory is null", async () => {
    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.rejectVersion("v2-id");
    });

    expect(mockUpdateVersionDecision).toHaveBeenCalledWith({
      versionId: "v2-id",
      decision: "rejected",
    });
  });
});

describe("useVersionControl — saveEdits error", () => {
  it("sets error and re-throws on saveEdits failure", async () => {
    mockSaveEditedVersion.mockRejectedValue(new Error("Save failed"));

    const { result } = renderHook(() =>
      useVersionControl({ proposalId: 1, autoLoadHistory: false })
    );

    await act(async () => {
      await result.current.loadHistory();
    });

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.saveEdits("v2-id", { intro: "edit" });
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError?.message).toBe("Save failed");
    expect(result.current.error?.message).toBe("Save failed");
  });
});
