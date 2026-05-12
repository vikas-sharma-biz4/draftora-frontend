/**
 * Tests for useProposalStatusStream hook
 *
 * Coverage targets:
 *   - SSE connection is established on autoStart
 *   - Status updates are received via SSE onmessage
 *   - SSE error triggers polling fallback
 *   - Polling calls getProposalStatus at intervals
 *   - Polling stops after MAX_POLL_ATTEMPTS
 *   - Completed status stops streaming and calls onCompleted
 *   - Failed status stops streaming and calls onFailed
 *   - Cancelled status stops streaming and calls onCancelled
 *   - stop() closes EventSource and clears timers
 *   - Cleanup on unmount closes everything
 */

import { renderHook, act } from "@testing-library/react";
import { useProposalStatusStream } from "@/hooks/useProposalStatusStream";
import * as proposalService from "@/services/proposal.service";
import type { ProposalStatus } from "@/services/proposal.service";
import * as auth from "@/utils/auth";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/proposal.service", () => ({
  getProposalStatus: jest.fn(),
}));

jest.mock("@/config/httpClient", () => ({
  API_BASE_URL: "https://api.test.example.com/api/v1",
}));

jest.mock("@/config/config", () => ({
  POLLING_INTERVAL_MS: 100, // Fast polling for tests
  MAX_POLL_ATTEMPTS: 5,
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/utils/auth", () => ({
  getAccessToken: jest.fn(),
}));

const mockGetProposalStatus = proposalService.getProposalStatus as jest.Mock;
const mockGetAccessToken = auth.getAccessToken as jest.Mock;

// ---------------------------------------------------------------------------
// BroadcastChannel mock
// ---------------------------------------------------------------------------

class MockBroadcastChannel {
  name: string;
  private _onmessage: ((event: MessageEvent) => void) | null = null;
  static instances: MockBroadcastChannel[] = [];
  static messageHandlers: Map<string, ((event: MessageEvent) => void)[]> = new Map();

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown): void {
    const handlers = MockBroadcastChannel.messageHandlers.get(this.name) || [];
    const event = { data } as MessageEvent;
    handlers.forEach((handler) => handler(event));
  }

  close(): void {
    const index = MockBroadcastChannel.instances.indexOf(this);
    if (index > -1) {
      MockBroadcastChannel.instances.splice(index, 1);
    }
    this._onmessage = null;
  }

  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this._onmessage = handler;
    if (!MockBroadcastChannel.messageHandlers.has(this.name)) {
      MockBroadcastChannel.messageHandlers.set(this.name, []);
    }
    const handlers = MockBroadcastChannel.messageHandlers.get(this.name)!;
    if (handler && !handlers.includes(handler)) {
      handlers.push(handler);
    }
  }

  get onmessage(): ((event: MessageEvent) => void) | null {
    return this._onmessage;
  }

  static reset(): void {
    MockBroadcastChannel.instances = [];
    MockBroadcastChannel.messageHandlers.clear();
  }
}

// ---------------------------------------------------------------------------
// EventSource mock
// ---------------------------------------------------------------------------

type EventSourceListener = ((event: { data: string }) => void) | null;

class MockEventSource {
  url: string;
  onmessage: EventSourceListener = null;
  onerror: ((event: Event) => void) | null = null;
  private listeners: Map<string, EventSourceListener[]> = new Map();
  private isClosed = false;
  static instances: MockEventSource[] = [];
  static shouldFail = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    if (MockEventSource.shouldFail) {
      throw new Error("EventSource not available");
    }
  }

  addEventListener(type: string, listener: EventSourceListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  close(): void {
    // Mark as closed
    this.isClosed = true;
    this.onmessage = null;
    this.onerror = null;
    this.listeners.clear();
  }

  // Test helpers
  simulateMessage(data: ProposalStatus): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateEvent(eventType: string, data: ProposalStatus): void {
    const handlers = this.listeners.get(eventType) || [];
    handlers.forEach((handler) => handler!({ data: JSON.stringify(data) }));
  }

  simulateError(): void {
    const errorHandlers = this.listeners.get("error") || [];
    const errorEvent = new Event("error");
    errorHandlers.forEach((handler) => {
      if (handler) {
        // Error handlers expect Event, not MessageEvent
        (handler as unknown as (event: Event) => void)(errorEvent);
      }
    });
    // Also call onerror if set
    if (this.onerror) {
      this.onerror(errorEvent);
    }
  }
}

// Replace global EventSource and BroadcastChannel with mocks
const OriginalEventSource = global.EventSource;
const OriginalBroadcastChannel = global.BroadcastChannel;

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).EventSource = MockEventSource;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).BroadcastChannel = MockBroadcastChannel;
});

afterAll(() => {
  global.EventSource = OriginalEventSource;
  global.BroadcastChannel = OriginalBroadcastChannel;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  MockEventSource.instances = [];
  MockEventSource.shouldFail = false;
  MockBroadcastChannel.reset();
  mockGetAccessToken.mockReturnValue("test-token-123");
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const inProgressStatus: ProposalStatus = {
  id: 1,
  status: "in_progress",
  generatingSection: "executive_summary",
  completedSections: [],
  selectedSections: null,
  currentStage: null,
  visitedPipelineSteps: [],
  highestVisitedStep: null,
};

const completedStatus: ProposalStatus = {
  id: 1,
  status: "completed",
  generatingSection: null,
  completedSections: ["executive_summary", "proposed_solution"],
  selectedSections: null,
  currentStage: null,
  visitedPipelineSteps: [],
  highestVisitedStep: null,
};

const failedStatus: ProposalStatus = {
  id: 1,
  status: "failed",
  generatingSection: null,
  completedSections: [],
  selectedSections: null,
  currentStage: null,
  visitedPipelineSteps: [],
  highestVisitedStep: null,
};

const defaultOptions = {
  proposalId: 1,
  autoStart: true,
};

// ---------------------------------------------------------------------------
// TODO: Update tests for polling + tab sync (SSE removed)
// ---------------------------------------------------------------------------

// describe("useProposalStatusStream — SSE connection", () => {
//   Tests commented out - hook now uses polling with tab synchronization instead of SSE
// });

// ---------------------------------------------------------------------------
// SSE message handling
// ---------------------------------------------------------------------------

// describe("useProposalStatusStream — SSE message handling", () => {
//   Tests commented out - hook now uses polling with tab synchronization instead of SSE
// });

// ---------------------------------------------------------------------------
// SSE error → polling fallback
// ---------------------------------------------------------------------------

// describe("useProposalStatusStream — SSE error fallback to polling", () => {
//   Tests commented out - hook now uses polling with tab synchronization instead of SSE
// });

// ---------------------------------------------------------------------------
// Polling behavior
// ---------------------------------------------------------------------------

describe("useProposalStatusStream — polling", () => {
  it("schedules next poll when status is in_progress", async () => {
    mockGetProposalStatus.mockResolvedValue(inProgressStatus);

    renderHook(() => useProposalStatusStream(defaultOptions));

    // Wait for leader election and first poll
    await act(async () => {
      jest.advanceTimersByTime(200); // Leader election timeout
      await Promise.resolve();
    });

    expect(mockGetProposalStatus).toHaveBeenCalledTimes(1);

    // Second poll after interval
    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(mockGetProposalStatus).toHaveBeenCalledTimes(2);
  });

  it("stops polling after MAX_POLL_ATTEMPTS", async () => {
    mockGetProposalStatus.mockResolvedValue(inProgressStatus);

    const { result } = renderHook(() => useProposalStatusStream(defaultOptions));

    // Run through all polls
    await act(async () => {
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      }
    });

    expect(result.current.pollCount).toBe(5);
    expect(result.current.errorMessage).toBe(
      "Generation is taking longer than expected. Please check back in a moment."
    );
    expect(result.current.isPolling).toBe(false);
  });

  it("stops polling when status becomes completed", async () => {
    mockGetProposalStatus.mockResolvedValue(completedStatus);

    const { result } = renderHook(() => useProposalStatusStream(defaultOptions));

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(result.current.isPolling).toBe(false);
    expect(mockGetProposalStatus).toHaveBeenCalledTimes(1); // no further polls
  });
});

// ---------------------------------------------------------------------------
// Manual start/stop
// ---------------------------------------------------------------------------

describe("useProposalStatusStream — start/stop", () => {
  it("start() begins polling", () => {
    const { result } = renderHook(() => useProposalStatusStream({
      ...defaultOptions,
      autoStart: false,
    }));

    act(() => {
      result.current.start();
    });

    expect(result.current.isPolling).toBe(true);
  });

  it("stop() stops polling", () => {
    const { result } = renderHook(() => useProposalStatusStream(defaultOptions));

    act(() => {
      result.current.stop();
    });

    expect(result.current.isPolling).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cleanup on unmount
// ---------------------------------------------------------------------------

describe("useProposalStatusStream — cleanup", () => {
  it("stops streaming on unmount", () => {
    const { unmount } = renderHook(() =>
      useProposalStatusStream(defaultOptions)
    );

    unmount();

    // After unmount, the hook is gone — we verify EventSource was closed
    // by checking that the instance's onmessage was nulled
    const es = MockEventSource.instances[0];
    expect(es.onmessage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cancelled status
// ---------------------------------------------------------------------------

describe("useProposalStatusStream — cancelled", () => {
  it("calls onCancelled and stops when status is cancelled", () => {
    const onCancelled = jest.fn();
    const { result } = renderHook(() => useProposalStatusStream({
      ...defaultOptions,
      onCancelled,
    }));

    const es = MockEventSource.instances[0];
    act(() => {
      es.simulateMessage({ ...inProgressStatus, status: "cancelled" });
    });

    expect(onCancelled).toHaveBeenCalled();
    expect(result.current.isPolling).toBe(false);
  });
});
