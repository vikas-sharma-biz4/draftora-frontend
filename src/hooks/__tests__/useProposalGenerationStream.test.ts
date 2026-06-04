/**
 * Unit tests for useProposalGenerationStream hook
 *
 * Tests the SSE client hook with reconnection logic, event parsing,
 * and connection lifecycle management.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { useProposalGenerationStream } from "../useProposalGenerationStream";

// Mock EventSource
class MockEventSource {
  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string | URL) {
    this.url = typeof url === "string" ? url : url.toString();
    this.readyState = 0; // CONNECTING
  }

  connect() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  emitMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data }));
    }
  }

  emitError() {
    this.readyState = 2; // CLOSED
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  close() {
    this.readyState = 2; // CLOSED
  }
}

// Mock global EventSource
(global as any).EventSource = MockEventSource;

describe("useProposalGenerationStream", () => {
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    mockEventSource = new MockEventSource("http://test.com/proposals/123/stream");
    jest.spyOn(window, "EventSource").mockImplementation((url: string | URL) => {
      mockEventSource.url = typeof url === "string" ? url : url.toString();
      return mockEventSource as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should connect to SSE endpoint when enabled", async () => {
    const onConnected = jest.fn();
    const onProgress = jest.fn();

    const { result } = renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onConnected,
        onProgress,
      })
    );

    // Simulate connection + "connected" event (isConnected/onConnected fire on message, not onopen)
    act(() => {
      mockEventSource.connect();
      mockEventSource.emitMessage(
        JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
      );
    });

    await waitFor(() => {
      expect(onConnected).toHaveBeenCalled();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("should not connect when disabled", () => {
    const onConnected = jest.fn();

    renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: false,
        onConnected,
      })
    );

    expect(onConnected).not.toHaveBeenCalled();
  });

  it("should parse and handle stage_changed events", async () => {
    const onStageChanged = jest.fn();

    renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onStageChanged,
      })
    );

    act(() => {
      mockEventSource.connect();
    });

    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(1);
    });

    const event = JSON.stringify({
      type: "stage_changed",
      data: { stage: "generating" },
      message: "AI generation in progress",
      timestamp: new Date().toISOString(),
    });

    act(() => {
      mockEventSource.emitMessage(event);
    });

    await waitFor(() => {
      expect(onStageChanged).toHaveBeenCalledWith("generating");
    });
  });

  it("should parse and handle section_started events", async () => {
    const onSectionStarted = jest.fn();

    renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onSectionStarted,
      })
    );

    act(() => {
      mockEventSource.connect();
    });

    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(1);
    });

    const event = JSON.stringify({
      type: "section_started",
      data: { section: "Executive Summary" },
      timestamp: new Date().toISOString(),
    });

    act(() => {
      mockEventSource.emitMessage(event);
    });

    await waitFor(() => {
      expect(onSectionStarted).toHaveBeenCalledWith("Executive Summary");
    });
  });

  it("should parse and handle section_completed events", async () => {
    const onSectionCompleted = jest.fn();

    renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onSectionCompleted,
      })
    );

    act(() => {
      mockEventSource.connect();
    });

    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(1);
    });

    const event = JSON.stringify({
      type: "section_completed",
      data: { section: "Executive Summary", completed: 3, total: 12 },
      timestamp: new Date().toISOString(),
    });

    act(() => {
      mockEventSource.emitMessage(event);
    });

    await waitFor(() => {
      expect(onSectionCompleted).toHaveBeenCalledWith("Executive Summary", 3, 12);
    });
  });

  it("should parse and handle progress events", async () => {
    const onProgress = jest.fn();

    renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onProgress,
      })
    );

    act(() => {
      mockEventSource.connect();
    });

    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(1);
    });

    const event = JSON.stringify({
      type: "progress",
      data: { percent: 50 },
      timestamp: new Date().toISOString(),
    });

    act(() => {
      mockEventSource.emitMessage(event);
    });

    await waitFor(() => {
      expect(onProgress).toHaveBeenCalledWith(50);
    });
  });

  it("should handle completed event", async () => {
    const onCompleted = jest.fn();

    renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onCompleted,
      })
    );

    act(() => {
      mockEventSource.connect();
    });

    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(1);
    });

    const event = JSON.stringify({
      type: "completed",
      timestamp: new Date().toISOString(),
    });

    act(() => {
      mockEventSource.emitMessage(event);
    });

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalled();
    });
  });

  it("should handle failed event", async () => {
    const onFailed = jest.fn();

    renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onFailed,
      })
    );

    act(() => {
      mockEventSource.connect();
    });

    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(1);
    });

    const event = JSON.stringify({
      type: "failed",
      message: "Generation failed: AI timeout",
      timestamp: new Date().toISOString(),
    });

    act(() => {
      mockEventSource.emitMessage(event);
    });

    await waitFor(() => {
      expect(onFailed).toHaveBeenCalledWith("Generation failed: AI timeout");
    });
  });

  it("should handle cancelled event", async () => {
    const onCancelled = jest.fn();

    renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onCancelled,
      })
    );

    act(() => {
      mockEventSource.connect();
    });

    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(1);
    });

    const event = JSON.stringify({
      type: "cancelled",
      timestamp: new Date().toISOString(),
    });

    act(() => {
      mockEventSource.emitMessage(event);
    });

    await waitFor(() => {
      expect(onCancelled).toHaveBeenCalled();
    });
  });

  it("should handle connection errors", async () => {
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onError,
      })
    );

    act(() => {
      mockEventSource.connect();
    });

    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(1);
    });

    act(() => {
      mockEventSource.emitError();
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      expect(result.current.error).not.toBeNull();
    });
  });

  it("should disconnect when disconnect function is called", async () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
      })
    );

    act(() => {
      mockEventSource.connect();
      mockEventSource.emitMessage(
        JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
      );
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      result.current.disconnect();
    });

    expect(mockEventSource.readyState).toBe(2); // CLOSED
  });

  it("should cleanup on unmount", async () => {
    const { unmount } = renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
      })
    );

    act(() => {
      mockEventSource.connect();
    });

    await waitFor(() => {
      expect(mockEventSource.readyState).toBe(1);
    });

    const closeSpy = jest.spyOn(mockEventSource, "close");

    act(() => {
      unmount();
    });

    expect(closeSpy).toHaveBeenCalled();
  });

  it("should handle heartbeat events", async () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
      })
    );

    // Emit "connected" so isConnected becomes true (set on message, not onopen)
    act(() => {
      mockEventSource.connect();
      mockEventSource.emitMessage(
        JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
      );
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const event = JSON.stringify({
      type: "heartbeat",
      timestamp: new Date().toISOString(),
    });

    // Should not throw error
    act(() => {
      mockEventSource.emitMessage(event);
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("should track reconnect count", async () => {
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
        onError,
      })
    );

    // Must emit "connected" first — onerror only retries when hasReceivedConnectedEvent=true
    act(() => {
      mockEventSource.connect();
      mockEventSource.emitMessage(
        JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
      );
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Trigger error to test reconnection
    act(() => {
      mockEventSource.emitError();
    });

    await waitFor(() => {
      expect(result.current.reconnectCount).toBeGreaterThan(0);
    });
  });

  it("should parse malformed events gracefully", async () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
      })
    );

    // Emit "connected" so isConnected becomes true before testing resilience
    act(() => {
      mockEventSource.connect();
      mockEventSource.emitMessage(
        JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
      );
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Send malformed JSON
    act(() => {
      mockEventSource.emitMessage("invalid json");
    });

    // Should not throw error
    expect(result.current.isConnected).toBe(true);
  });

  it("should handle unknown event types", async () => {
    const { result } = renderHook(() =>
      useProposalGenerationStream({
        proposalId: 123,
        enabled: true,
      })
    );

    // Emit "connected" so isConnected becomes true before testing unknown events
    act(() => {
      mockEventSource.connect();
      mockEventSource.emitMessage(
        JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })
      );
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const event = JSON.stringify({
      type: "unknown_event",
      timestamp: new Date().toISOString(),
    });

    // Should not throw error
    act(() => {
      mockEventSource.emitMessage(event);
    });

    expect(result.current.isConnected).toBe(true);
  });
});
