/**
 * useProposalGenerationStream — SSE client hook for proposal generation
 *
 * Provides real-time streaming of generation events from backend via Server-Sent Events.
 * Handles reconnection, error recovery, and event parsing.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event type parsing and routing
 * - Connection lifecycle management
 * - Error state handling
 * - Cleanup on unmount
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/utils/logger";

type GenerationEventType =
  | "connected"
  | "heartbeat"
  | "legacy"
  | "stage_changed"
  | "section_started"
  | "section_completed"
  | "section_failed"
  | "progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "error";

interface GenerationEvent {
  type: GenerationEventType;
  data?: Record<string, unknown>;
  message?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface UseProposalGenerationStreamOptions {
  proposalId: number;
  onConnected?: (data: { selectedSections: string[]; totalSections: number; proposalStatus: string }) => void;
  onStageChanged?: (stage: string) => void;
  onSectionStarted?: (section: string) => void;
  onSectionCompleted?: (section: string, completed: number, total: number) => void;
  onProgress?: (percent: number) => void;
  onCompleted?: () => void;
  onFailed?: (message: string) => void;
  onCancelled?: () => void;
  onError?: (error: Error) => void;
  onLegacy?: (status: string) => void;
  enabled?: boolean;
}

interface UseProposalGenerationStreamReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnectCount: number;
  disconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 45000; // 45 seconds
const STREAM_CONNECT_TIMEOUT = 5000; // 5 seconds — if no event within this time on fresh connect, check readyState

export function useProposalGenerationStream(
  options: UseProposalGenerationStreamOptions
): UseProposalGenerationStreamReturn {
  const {
    proposalId,
    onConnected,
    onStageChanged,
    onSectionStarted,
    onSectionCompleted,
    onProgress,
    onCompleted,
    onFailed,
    onCancelled,
    onError,
    onLegacy,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(INITIAL_RECONNECT_DELAY);
  const isMountedRef = useRef<boolean>(true);
  const reconnectCountRef = useRef<number>(0);

  // Stable refs for callbacks so they don't cause re-renders
  const callbacksRef = useRef({
    onConnected,
    onStageChanged,
    onSectionStarted,
    onSectionCompleted,
    onProgress,
    onCompleted,
    onFailed,
    onCancelled,
    onError,
    onLegacy,
  });
  // Keep callbacks ref up to date
  callbacksRef.current = {
    onConnected,
    onStageChanged,
    onSectionStarted,
    onSectionCompleted,
    onProgress,
    onCompleted,
    onFailed,
    onCancelled,
    onError,
    onLegacy,
  };

  // ── Disconnect: close EventSource and clear all timers ──────────────
  const disconnect = useCallback(() => {
    logger.info("[SSE] Disconnecting");

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // ── Reset heartbeat timer ────────────────────────────────────────────
  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setTimeout(() => {
      logger.warn("[SSE] Heartbeat timeout, reconnecting...");
      // Use the connect function from the ref to avoid dependency issues
      disconnect();
      attemptReconnectInternal();
    }, HEARTBEAT_TIMEOUT);
  }, [disconnect]);

  // ── Attempt reconnect (internal, uses ref) ───────────────────────────
  // This function is defined before connect so it can be referenced.
  // We use a ref-based approach to avoid circular dependencies.
  const connectFnRef = useRef<() => void>(() => {});

  const attemptReconnectInternal = useCallback(() => {
    if (!isMountedRef.current || reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    const currentCount = reconnectCountRef.current + 1;
    reconnectCountRef.current = currentCount;
    setReconnectCount(currentCount);

    logger.info("[SSE] Attempting reconnect", {
      attempt: currentCount,
      delay: reconnectDelayRef.current,
    });

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    const delay = reconnectDelayRef.current;
    reconnectDelayRef.current = Math.min(
      reconnectDelayRef.current * 2,
      MAX_RECONNECT_DELAY
    );

    reconnectTimerRef.current = setTimeout(() => {
      connectFnRef.current();
    }, delay);
  }, []);

  // ── Connect: create EventSource and wire up handlers ─────────────────
  const connect = useCallback(() => {
    if (!isMountedRef.current || !enabled) {
      return;
    }

    // Close any existing connection first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnecting(true);
    setError(null);

    const url = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/proposals/${proposalId}/stream`;
    logger.info("[SSE] Connecting", { url, proposalId });

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Track whether we've ever successfully received a connected event.
      // If onerror fires before we get the connected event, it's likely
      // an HTTP error (404/403/500) which is NOT retryable.
      let hasReceivedConnectedEvent = false;

      eventSource.onopen = () => {
        logger.info("[SSE] Connection opened (HTTP 200)");
        resetHeartbeat();
      };

      eventSource.onmessage = (event: MessageEvent) => {
        // Parse event to check if it's the connected event
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected") {
            hasReceivedConnectedEvent = true;
          }
        } catch (e) {
          // Ignore parse errors, handleEvent will log them
        }
        resetHeartbeat();

        try {
          const data: GenerationEvent = JSON.parse(event.data);

          logger.info("[SSE] Event received", {
            type: data.type,
            proposalId,
            timestamp: data.timestamp,
          });

          const cb = callbacksRef.current;

          switch (data.type) {
            case "connected":
              setIsConnected(true);
              setIsConnecting(false);
              setError(null);
              reconnectCountRef.current = 0;
              setReconnectCount(0);
              reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
              cb.onConnected?.({
                selectedSections: (data.data?.selectedSections as string[]) || [],
                totalSections: (data.data?.totalSections as number) || 0,
                proposalStatus: (data.data?.proposalStatus as string) || "queued",
              });
              break;

            case "heartbeat":
              // Just reset heartbeat timer (already done above)
              break;

            case "legacy":
              logger.info("[SSE] Legacy proposal detected, no real-time events available");
              setIsConnected(true);
              setIsConnecting(false);
              cb.onLegacy?.(data.data?.status as string || "unknown");
              break;

            case "stage_changed":
              cb.onStageChanged?.(data.data?.stage as string);
              break;

            case "section_started":
              cb.onSectionStarted?.(data.data?.section as string);
              break;

            case "section_completed":
              cb.onSectionCompleted?.(
                data.data?.section as string,
                data.data?.completed as number,
                data.data?.total as number
              );
              break;

            case "section_failed":
              logger.error("[SSE] Section failed", data);
              break;

            case "progress":
              cb.onProgress?.(data.data?.percent as number);
              break;

            case "completed":
              cb.onCompleted?.();
              disconnect();
              break;

            case "failed":
              cb.onFailed?.(data.message || "Generation failed");
              disconnect();
              break;

            case "cancelled":
              cb.onCancelled?.();
              disconnect();
              break;

            case "error":
              const err = new Error(data.message || "Unknown error");
              cb.onError?.(err);
              setError(err);
              break;

            default:
              logger.warn("[SSE] Unknown event type", data);
          }
        } catch (err) {
          logger.error("[SSE] Failed to parse event", err);
        }
      };

      eventSource.onerror = () => {
        logger.error("[SSE] Connection error");

        setIsConnected(false);
        setIsConnecting(false);

        // If we never successfully received a connected event, this is likely
        // an HTTP error (404, 403, 500) or the connection failed before
        // the server could send the initial event. Do NOT retry — the
        // endpoint won't become available.
        if (!hasReceivedConnectedEvent) {
          const fatalErr = new Error(
            "SSE endpoint unavailable. The server rejected the connection."
          );
          setError(fatalErr);
          callbacksRef.current.onError?.(fatalErr);
          disconnect();
          return;
        }

        // We had a working connection before — this is a transient disconnect.
        // Safe to retry with backoff.
        const error = new Error("SSE connection error");
        setError(error);
        callbacksRef.current.onError?.(error);

        if (isMountedRef.current && reconnectCountRef.current < MAX_RECONNECT_ATTEMPTS) {
          attemptReconnectInternal();
        } else {
          logger.error("[SSE] Max reconnection attempts reached");
          disconnect();
        }
      };
    } catch (err) {
      logger.error("[SSE] Failed to create EventSource", err);
      setIsConnecting(false);
      const error = err instanceof Error ? err : new Error("Failed to connect");
      setError(error);
      callbacksRef.current.onError?.(error);
    }
  }, [proposalId, enabled, disconnect, resetHeartbeat, attemptReconnectInternal]);

  // Store the latest connect function in the ref so reconnect can call it
  connectFnRef.current = connect;

  // ── Main effect: connect when enabled/proposalId change ONLY ─────────
  // We intentionally do NOT include connect/disconnect in the deps
  // to prevent the infinite re-render loop that was causing rapid
  // connect/disconnect cycles.
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled && proposalId) {
      // Reset reconnection state on fresh mount/proposal change
      reconnectCountRef.current = 0;
      setReconnectCount(0);
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, proposalId]);

  return {
    isConnected,
    isConnecting,
    error,
    reconnectCount,
    disconnect,
  };
}
