/**
 * useProposalStatusPolling — proposal generation status polling
 *
 * Uses HTTP polling to receive status updates from the backend.
 * Implements tab synchronization via BroadcastChannel to ensure only one tab polls.
 *
 * Polling endpoint: GET /api/v1/proposals/:id/status/
 *   - Returns JSON payload with ProposalStatus including:
 *     - status: overall generation status
 *     - completedSections: list of section keys that have been generated
 *     - generatingSection: currently generating section key
 *     - selectedSections: all sections to be generated
 *     - currentStage: current generation stage
 *
 * Polling behavior:
 *   - Polls at POLLING_INTERVAL_MS intervals (from config)
 *   - Stops after MAX_POLL_ATTEMPTS if generation takes too long
 *   - Implements exponential backoff retry on network errors (up to MAX_RETRIES)
 *   - Automatically stops when status is "completed", "failed", or "cancelled"
 *
 * Tab synchronization:
 *   - Uses BroadcastChannel to coordinate multiple tabs
 *   - Only the leader tab performs actual HTTP polling
 *   - Non-leader tabs receive status updates via BroadcastChannel messages
 *   - Leadership is claimed via heartbeat mechanism with LEADER_TIMEOUT
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { POLLING_INTERVAL_MS, MAX_POLL_ATTEMPTS } from "@/config/config";
import { getProposalStatus } from "@/services/proposal.service";
import type { ProposalStatus } from "@/interfaces/proposalInterfaces";
import { logger } from "@/utils/logger";

const LEADER_HEARTBEAT_INTERVAL = 1000;
const LEADER_TIMEOUT = 3000;

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

interface UseProposalStatusPollingOptions {
  proposalId: number;
  /** Start polling immediately (default: true) */
  autoStart?: boolean;
  /** Called on each status update */
  onStatusUpdate?: (status: ProposalStatus) => void;
  /** Called when generation completes */
  onCompleted?: (status: ProposalStatus) => void;
  /** Called when generation fails */
  onFailed?: (status: ProposalStatus) => void;
  /** Called when generation is cancelled */
  onCancelled?: () => void;
  /** Called on polling error */
  onError?: (error: Error) => void;
}

interface UseProposalStatusPollingReturn {
  status: ProposalStatus | null;
  isPolling: boolean;
  pollCount: number;
  errorMessage: string;
  start: () => void;
  stop: () => void;
}

export function useProposalStatusPolling(
  options: UseProposalStatusPollingOptions
): UseProposalStatusPollingReturn {
  const {
    proposalId,
    autoStart = true,
    onStatusUpdate,
    onCompleted,
    onFailed,
    onCancelled,
    onError,
  } = options;

  const [status, setStatus] = useState<ProposalStatus | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [pollCount, setPollCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef<number>(0);
  const stoppedRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);

  // Stabilize callbacks in refs so poll() doesn't recreate on every render
  const callbacksRef = useRef({
    onStatusUpdate,
    onCompleted,
    onFailed,
    onCancelled,
    onError,
  });
  callbacksRef.current = { onStatusUpdate, onCompleted, onFailed, onCancelled, onError };

  // Tab synchronization
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isLeaderRef = useRef<boolean>(false);
  const lastLeaderHeartbeatRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leaderCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    stoppedRef.current = true;

    // Clear polling timer
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    // Clear heartbeat timers
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (leaderCheckTimerRef.current) {
      clearInterval(leaderCheckTimerRef.current);
      leaderCheckTimerRef.current = null;
    }

    // Close broadcast channel
    if (channelRef.current) {
      channelRef.current.close();
      channelRef.current = null;
    }

    // Reset retry state
    retryCountRef.current = 0;
    isPollingRef.current = false;

    isLeaderRef.current = false;
    setIsPolling(false);
  }, []);

  const handleStatusData = useCallback(
    (data: ProposalStatus) => {
      setStatus(data);
      callbacksRef.current.onStatusUpdate?.(data);

      if (data.status === "completed") {
        stop();
        callbacksRef.current.onCompleted?.(data);
        return;
      }

      if (data.status === "failed") {
        stop();
        setErrorMessage("Proposal generation failed. Please go back and try again.");
        callbacksRef.current.onFailed?.(data);
        return;
      }

      if (data.status === "cancelled") {
        stop();
        callbacksRef.current.onCancelled?.();
        return;
      }
    },
    [stop]
  );

  // ── Tab Synchronization ──────────────────────────────────────────

  const becomeLeader = useCallback(() => {
    if (isLeaderRef.current) return;

    isLeaderRef.current = true;
    lastLeaderHeartbeatRef.current = Date.now();

    logger.debug("[useProposalStatusPolling] This tab became the polling leader");

    // Send heartbeat every second
    heartbeatTimerRef.current = setInterval(() => {
      if (channelRef.current && isLeaderRef.current) {
        channelRef.current.postMessage({ type: "heartbeat", timestamp: Date.now() });
      }
    }, LEADER_HEARTBEAT_INTERVAL);
  }, []);

  const resignLeadership = useCallback(() => {
    if (!isLeaderRef.current) return;

    isLeaderRef.current = false;

    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    logger.debug("[useProposalStatusPolling] This tab resigned leadership");
  }, []);

  // ── Polling ──────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    if (stoppedRef.current) return;

    // Prevent overlapping poll executions
    if (isPollingRef.current) {
      logger.debug("[useProposalStatusPolling] Skipping poll - already polling");
      return;
    }

    // Only poll if this tab is the leader
    if (!isLeaderRef.current) {
      logger.debug("[useProposalStatusPolling] Skipping poll - not leader");
      return;
    }

    isPollingRef.current = true;

    try {
      const data = await getProposalStatus(proposalId);
      handleStatusData(data);

      // Reset retry count on successful poll
      retryCountRef.current = 0;

      // Broadcast status to other tabs
      if (channelRef.current) {
        channelRef.current.postMessage({ type: "status", data });
      }

      // If still in progress, schedule next poll
      if (data.status === "in_progress" || data.status === "pending") {
        pollCountRef.current += 1;
        setPollCount(pollCountRef.current);

        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          setErrorMessage(
            "Generation is taking longer than expected. Please check back in a moment."
          );
          stop();
          return;
        }

        pollTimerRef.current = setTimeout(poll, POLLING_INTERVAL_MS);
      }
    } catch (error) {
      retryCountRef.current += 1;

      if (retryCountRef.current <= MAX_RETRIES) {
        const retryDelay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current - 1);
        logger.warn(
          `[useProposalStatusPolling] Polling error (attempt ${retryCountRef.current}/${MAX_RETRIES}), retrying in ${retryDelay}ms:`,
          error
        );
        pollTimerRef.current = setTimeout(poll, retryDelay);
      } else {
        logger.error(
          `[useProposalStatusPolling] Polling failed after ${MAX_RETRIES} retries:`,
          error
        );
        setErrorMessage(
          "Unable to check proposal status. Please refresh the page and try again."
        );
        callbacksRef.current.onError?.(error as Error);
        stop();
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [proposalId, handleStatusData]);

  const start = useCallback(() => {
    stoppedRef.current = false;
    setErrorMessage("");
    setPollCount(0);
    pollCountRef.current = 0;
    retryCountRef.current = 0;
    setIsPolling(true);
    void poll();
  }, [poll]);

  // Initialize BroadcastChannel for tab synchronization
  useEffect(() => {
    const channelName = `proposal-status-${proposalId}`;

    try {
      channelRef.current = new BroadcastChannel(channelName);

      // Listen for messages from other tabs
      channelRef.current.onmessage = (event) => {
        const { type, data, timestamp } = event.data;

        if (type === "heartbeat") {
          // Another tab is the leader
          lastLeaderHeartbeatRef.current = timestamp;

          // If we were leader, resign
          if (isLeaderRef.current) {
            resignLeadership();
          }
        } else if (type === "status") {
          // Receive status update from leader tab
          handleStatusData(data);
        }
      };

      // Check for leader timeout and claim leadership if needed
      leaderCheckTimerRef.current = setInterval(() => {
        const timeSinceLastHeartbeat = Date.now() - lastLeaderHeartbeatRef.current;

        if (timeSinceLastHeartbeat > LEADER_TIMEOUT && !isLeaderRef.current) {
          logger.debug("[useProposalStatusPolling] No leader detected, claiming leadership");
          becomeLeader();

          // Start polling if we should be polling
          if (autoStart && !stoppedRef.current) {
            void poll();
          }
        }
      }, 1000);

      // Initially try to become leader (first tab wins)
      setTimeout(() => {
        if (!isLeaderRef.current) {
          becomeLeader();
          if (autoStart && !stoppedRef.current) {
            void poll();
          }
        }
      }, 100);

    } catch (error) {
      logger.warn("[useProposalStatusPolling] BroadcastChannel not supported, tab sync disabled", error);
      // Fallback: just become leader if BroadcastChannel isn't supported
      becomeLeader();
    }

    return () => {
      resignLeadership();

      if (leaderCheckTimerRef.current) {
        clearInterval(leaderCheckTimerRef.current);
        leaderCheckTimerRef.current = null;
      }

      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [proposalId, becomeLeader, resignLeadership, handleStatusData, autoStart, poll]);

  // Auto-start
  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => {
      stop();
    };
  }, [autoStart, start, stop]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    isPolling,
    pollCount,
    errorMessage,
    start,
    stop,
  };
}
