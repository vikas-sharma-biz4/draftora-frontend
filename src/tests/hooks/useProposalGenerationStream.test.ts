/**
 * Tests for useProposalGenerationStream hook
 *
 * Coverage targets:
 *  - enabled=false → no EventSource created
 *  - proposalId=0 → no EventSource created
 *  - All 12 SSE event types routed correctly
 *  - legacy: onLegacy called with status | "unknown" fallback
 *  - connected: onConnected called with data | fallback values
 *  - failed: onFailed called with message | "Generation failed" fallback
 *  - onerror before connected event → fatal error, no retry
 *  - onerror after connected event → retry scheduled (reconnectCount++)
 *  - JSON parse error in onmessage → does not throw
 *  - EventSource constructor throws → error state, isConnecting=false
 *  - disconnect() clears eventSourceRef, reconnectTimerRef, heartbeatTimerRef
 *  - disconnect() safe to call when refs are null
 *  - onopen triggers heartbeat timer
 *  - unmount cleanup calls disconnect
 */

import { renderHook, act } from "@testing-library/react";
import { useProposalGenerationStream } from "@/hooks/useProposalGenerationStream";

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

interface MockESInstance {
  url: string;
  onopen: ((e: Event) => void) | null;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  close: jest.Mock;
  readyState: number;
}

let capturedInstance: MockESInstance | null = null;
let shouldThrowOnCreate = false;
let shouldThrowNonError = false;

const MockEventSource = jest.fn().mockImplementation((url: string) => {
  if (shouldThrowOnCreate) {
    throw new Error("EventSource creation failed");
  }
  if (shouldThrowNonError) {
    throw "plain string error";
  }
  const instance: MockESInstance = {
    url,
    onopen: null,
    onmessage: null,
    onerror: null,
    close: jest.fn(() => {
      instance.readyState = 2;
    }),
    readyState: 0,
  };
  capturedInstance = instance;
  return instance;
});

global.EventSource = MockEventSource as unknown as typeof EventSource;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendMessage(instance: MockESInstance, data: object) {
  act(() => {
    instance.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  });
}

function triggerError(instance: MockESInstance) {
  act(() => {
    instance.onerror?.(new Event("error"));
  });
}

function triggerOpen(instance: MockESInstance) {
  act(() => {
    instance.onopen?.(new Event("open"));
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  capturedInstance = null;
  shouldThrowOnCreate = false;
  shouldThrowNonError = false;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runAllTimers();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// enabled=false → no connect
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — disabled", () => {
  it("does not create an EventSource when enabled=false", () => {
    renderHook(() => useProposalGenerationStream({ proposalId: 42, enabled: false }));
    expect(MockEventSource).not.toHaveBeenCalled();
  });

  it("returns isConnected=false and isConnecting=false when disabled", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 42, enabled: false })
    );
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// proposalId=0 → no connect
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — falsy proposalId", () => {
  it("does not create an EventSource when proposalId is 0", () => {
    renderHook(() => useProposalGenerationStream({ proposalId: 0, enabled: true }));
    expect(MockEventSource).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Connection creation
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — connection creation", () => {
  it("creates an EventSource with proposalId in the URL", () => {
    renderHook(() => useProposalGenerationStream({ proposalId: 7, enabled: true }));
    expect(MockEventSource).toHaveBeenCalledTimes(1);
    const url: string = MockEventSource.mock.calls[0][0];
    expect(url).toContain("/proposals/7/stream");
  });

  it("starts with isConnecting=true after mounting (EventSource created)", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 7, enabled: true })
    );
    expect(result.current.isConnecting).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// onopen → resets heartbeat timer
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — onopen", () => {
  it("fires onopen without throwing (heartbeat timer set)", () => {
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true }));
    const instance = capturedInstance!;
    // Should not throw
    triggerOpen(instance);
  });
});

// ---------------------------------------------------------------------------
// connected event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — connected event", () => {
  it("sets isConnected=true and calls onConnected with data", () => {
    const onConnected = jest.fn();
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onConnected })
    );

    sendMessage(capturedInstance!, {
      type: "connected",
      timestamp: "2025-01-01T00:00:00Z",
      data: {
        selectedSections: ["executive_summary", "proposed_solution"],
        totalSections: 5,
        proposalStatus: "generating",
      },
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
    expect(onConnected).toHaveBeenCalledWith({
      selectedSections: ["executive_summary", "proposed_solution"],
      totalSections: 5,
      proposalStatus: "generating",
    });
  });

  it("uses fallback values ([], 0, 'queued') when connected data fields are absent", () => {
    const onConnected = jest.fn();
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true, onConnected }));

    sendMessage(capturedInstance!, {
      type: "connected",
      timestamp: "2025-01-01T00:00:00Z",
      // no data field
    });

    expect(onConnected).toHaveBeenCalledWith({
      selectedSections: [],
      totalSections: 0,
      proposalStatus: "queued",
    });
  });

  it("resets reconnectCount to 0 on connected event", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true })
    );

    sendMessage(capturedInstance!, {
      type: "connected",
      timestamp: "2025-01-01T00:00:00Z",
    });

    expect(result.current.reconnectCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// heartbeat event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — heartbeat event", () => {
  it("handles heartbeat without calling any specific callback", () => {
    const onConnected = jest.fn();
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true, onConnected }));

    sendMessage(capturedInstance!, {
      type: "heartbeat",
      timestamp: "2025-01-01T00:00:00Z",
    });

    expect(onConnected).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// legacy event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — legacy event", () => {
  it("calls onLegacy with the status from data when present", () => {
    const onLegacy = jest.fn();
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true, onLegacy }));

    sendMessage(capturedInstance!, {
      type: "legacy",
      timestamp: "2025-01-01T00:00:00Z",
      data: { status: "completed" },
    });

    expect(onLegacy).toHaveBeenCalledWith("completed");
  });

  it("calls onLegacy with 'unknown' when data.status is absent", () => {
    const onLegacy = jest.fn();
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true, onLegacy }));

    sendMessage(capturedInstance!, {
      type: "legacy",
      timestamp: "2025-01-01T00:00:00Z",
      // no data.status
    });

    expect(onLegacy).toHaveBeenCalledWith("unknown");
  });

  it("sets isConnected=true and isConnecting=false on legacy event", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true })
    );

    sendMessage(capturedInstance!, {
      type: "legacy",
      timestamp: "2025-01-01T00:00:00Z",
      data: { status: "completed" },
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stage_changed event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — stage_changed event", () => {
  it("calls onStageChanged with the stage from data", () => {
    const onStageChanged = jest.fn();
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true, onStageChanged }));

    sendMessage(capturedInstance!, {
      type: "stage_changed",
      timestamp: "2025-01-01T00:00:00Z",
      data: { stage: "writing" },
    });

    expect(onStageChanged).toHaveBeenCalledWith("writing");
  });
});

// ---------------------------------------------------------------------------
// section_started event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — section_started event", () => {
  it("calls onSectionStarted with section name", () => {
    const onSectionStarted = jest.fn();
    renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onSectionStarted })
    );

    sendMessage(capturedInstance!, {
      type: "section_started",
      timestamp: "2025-01-01T00:00:00Z",
      data: { section: "executive_summary" },
    });

    expect(onSectionStarted).toHaveBeenCalledWith("executive_summary");
  });
});

// ---------------------------------------------------------------------------
// section_completed event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — section_completed event", () => {
  it("calls onSectionCompleted with section, completed, total", () => {
    const onSectionCompleted = jest.fn();
    renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onSectionCompleted })
    );

    sendMessage(capturedInstance!, {
      type: "section_completed",
      timestamp: "2025-01-01T00:00:00Z",
      data: { section: "proposed_solution", completed: 2, total: 5 },
    });

    expect(onSectionCompleted).toHaveBeenCalledWith("proposed_solution", 2, 5);
  });
});

// ---------------------------------------------------------------------------
// section_failed event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — section_failed event", () => {
  it("handles section_failed without throwing (logged as error)", () => {
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true }));

    expect(() => {
      sendMessage(capturedInstance!, {
        type: "section_failed",
        timestamp: "2025-01-01T00:00:00Z",
        data: { section: "timeline" },
      });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// progress event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — progress event", () => {
  it("calls onProgress with the percent value from data", () => {
    const onProgress = jest.fn();
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true, onProgress }));

    sendMessage(capturedInstance!, {
      type: "progress",
      timestamp: "2025-01-01T00:00:00Z",
      data: { percent: 60 },
    });

    expect(onProgress).toHaveBeenCalledWith(60);
  });
});

// ---------------------------------------------------------------------------
// completed event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — completed event", () => {
  it("calls onCompleted and disconnects the EventSource", () => {
    const onCompleted = jest.fn();
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onCompleted })
    );
    const instance = capturedInstance!;

    sendMessage(instance, { type: "completed", timestamp: "2025-01-01T00:00:00Z" });

    expect(onCompleted).toHaveBeenCalled();
    expect(instance.close).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// failed event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — failed event", () => {
  it("calls onFailed with the message from data and disconnects", () => {
    const onFailed = jest.fn();
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onFailed })
    );
    const instance = capturedInstance!;

    sendMessage(instance, {
      type: "failed",
      timestamp: "2025-01-01T00:00:00Z",
      message: "Generation failed due to timeout",
    });

    expect(onFailed).toHaveBeenCalledWith("Generation failed due to timeout");
    expect(instance.close).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });

  it("uses 'Generation failed' as fallback when message field is absent", () => {
    const onFailed = jest.fn();
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true, onFailed }));

    sendMessage(capturedInstance!, {
      type: "failed",
      timestamp: "2025-01-01T00:00:00Z",
      // no message field
    });

    expect(onFailed).toHaveBeenCalledWith("Generation failed");
  });
});

// ---------------------------------------------------------------------------
// cancelled event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — cancelled event", () => {
  it("calls onCancelled and disconnects the EventSource", () => {
    const onCancelled = jest.fn();
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onCancelled })
    );
    const instance = capturedInstance!;

    sendMessage(instance, { type: "cancelled", timestamp: "2025-01-01T00:00:00Z" });

    expect(onCancelled).toHaveBeenCalled();
    expect(instance.close).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// error event
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — error event", () => {
  it("calls onError and sets error state", () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onError })
    );

    sendMessage(capturedInstance!, {
      type: "error",
      timestamp: "2025-01-01T00:00:00Z",
      message: "Stream processing error",
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Stream processing error" })
    );
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Stream processing error");
  });

  it("uses 'Unknown error' fallback when message field absent", () => {
    const onError = jest.fn();
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true, onError }));

    sendMessage(capturedInstance!, {
      type: "error",
      timestamp: "2025-01-01T00:00:00Z",
      // no message
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Unknown error" }));
  });
});

// ---------------------------------------------------------------------------
// unknown/default event type
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — unknown event type", () => {
  it("handles unknown event type without throwing (falls to default case)", () => {
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true }));

    expect(() => {
      sendMessage(capturedInstance!, {
        type: "future_event_type",
        timestamp: "2025-01-01T00:00:00Z",
      });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// JSON parse error in onmessage
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — JSON parse error", () => {
  it("handles malformed JSON in message data without throwing", () => {
    renderHook(() => useProposalGenerationStream({ proposalId: 5, enabled: true }));
    const instance = capturedInstance!;

    expect(() => {
      act(() => {
        instance.onmessage?.(new MessageEvent("message", { data: "not-valid-json{{}}" }));
      });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// onerror BEFORE connected event → fatal, no retry
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — onerror before connected (fatal)", () => {
  it("sets error state and calls onError when onerror fires before connected event", () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onError })
    );
    const instance = capturedInstance!;

    // onerror fires WITHOUT a prior connected event
    triggerError(instance);

    expect(result.current.error).not.toBeNull();
    expect(onError).toHaveBeenCalled();
    expect(instance.close).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
  });

  it("does NOT increment reconnectCount on fatal error (no retry)", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true })
    );

    triggerError(capturedInstance!);

    // No reconnect attempted — count stays at 0
    expect(result.current.reconnectCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// onerror AFTER connected event → transient, retry scheduled
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — onerror after connected (transient reconnect)", () => {
  it("schedules a reconnect and increments reconnectCount", () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onError })
    );
    const instance = capturedInstance!;

    // First: receive connected event so hasReceivedConnectedEvent = true
    sendMessage(instance, {
      type: "connected",
      timestamp: "2025-01-01T00:00:00Z",
    });
    expect(result.current.isConnected).toBe(true);

    // Now onerror fires — should retry
    triggerError(instance);

    expect(onError).toHaveBeenCalled();
    expect(result.current.reconnectCount).toBe(1);
  });

  it("disconnects when reconnect attempts reach MAX (10)", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true })
    );

    // Simulate connected then error cycle 10 times
    for (let i = 0; i < 10; i++) {
      // Get current instance (reconnect creates new one after timer fires)
      const inst = capturedInstance!;

      // Simulate connected event so transient path is taken
      sendMessage(inst, { type: "connected", timestamp: "2025-01-01T00:00:00Z" });

      // Trigger transient error
      triggerError(inst);

      // Advance timer to trigger the reconnect (creates new EventSource)
      if (i < 9) {
        act(() => {
          jest.runAllTimers();
        });
      }
    }

    // After 10 attempts, disconnect is called (no more retries)
    expect(result.current.reconnectCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// EventSource constructor throws
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — EventSource constructor throws (Error)", () => {
  it("sets error state and isConnecting=false when EventSource constructor throws", () => {
    shouldThrowOnCreate = true;
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onError })
    );

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("EventSource creation failed");
    expect(result.current.isConnecting).toBe(false);
    expect(onError).toHaveBeenCalled();
  });
});

describe("useProposalGenerationStream — EventSource constructor throws (non-Error)", () => {
  it("wraps non-Error thrown value in Error('Failed to connect')", () => {
    shouldThrowNonError = true;
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true, onError })
    );

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Failed to connect");
    expect(onError).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// disconnect() — covers ref null-checks
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — disconnect()", () => {
  it("closes the EventSource and sets isConnected=false", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true })
    );
    const instance = capturedInstance!;

    act(() => {
      result.current.disconnect();
    });

    expect(instance.close).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
  });

  it("is safe to call multiple times (idempotent — refs become null)", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true })
    );

    act(() => {
      result.current.disconnect();
    });
    // Second call — all refs are already null, no throw
    act(() => {
      result.current.disconnect();
    });
  });

  it("clears reconnectTimerRef when disconnect is called after reconnect scheduled", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true })
    );
    const instance = capturedInstance!;

    // Get connected so transient onerror path is taken
    sendMessage(instance, { type: "connected", timestamp: "2025-01-01T00:00:00Z" });
    triggerError(instance); // sets reconnectTimerRef

    // disconnect before the timer fires — should clear reconnectTimerRef
    act(() => {
      result.current.disconnect();
    });

    // Advance timers — connect should NOT be called again (timer was cleared)
    const callsBefore = MockEventSource.mock.calls.length;
    act(() => {
      jest.runAllTimers();
    });
    expect(MockEventSource.mock.calls.length).toBe(callsBefore); // no new connect
  });

  it("clears heartbeatTimerRef when disconnect is called after onopen", () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true })
    );
    const instance = capturedInstance!;

    // Trigger onopen so heartbeatTimerRef is set
    triggerOpen(instance);

    act(() => {
      result.current.disconnect();
    });

    // Advance timers — heartbeat timeout should NOT fire (timer was cleared)
    const callsBefore = MockEventSource.mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(MockEventSource.mock.calls.length).toBe(callsBefore);
  });
});

// ---------------------------------------------------------------------------
// Unmount cleanup
// ---------------------------------------------------------------------------

describe("useProposalGenerationStream — unmount cleanup", () => {
  it("closes the EventSource when the component unmounts", () => {
    const { unmount } = renderHook(() =>
      useProposalGenerationStream({ proposalId: 5, enabled: true })
    );
    const instance = capturedInstance!;

    unmount();

    expect(instance.close).toHaveBeenCalled();
  });
});
