/**
 * useProposalStatusStream — real-time proposal generation status
 *
 * Uses polling to receive status updates from the backend.
 * Implements tab synchronization via BroadcastChannel to ensure only one tab polls.
 *
 * Polling endpoint: GET /api/v1/proposals/:id/status/
 *   - Returns JSON payload with ProposalStatus including:
 *     - status: overall generation status
 *     - completedSections: list of section keys that have been generated
 *     - generatingSection: currently generating section key
 *     - selectedSections: all sections to be generated
 *     - currentStage: current generation stage
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { POLLING_INTERVAL_MS, MAX_POLL_ATTEMPTS } from "@/config/config";
import { getProposalStatus, type ProposalStatus } from "@/services/proposal.service";
import { logger } from "@/utils/logger";

const LEADER_HEARTBEAT_INTERVAL = 1000;
const LEADER_TIMEOUT = 3000;

interface UseProposalStatusStreamOptions {
  proposalId: number;
  /** Start polling immediately (default: true) */
  autoStart?: boolean;
  /** Disable tab synchronization and always poll (default: false) */
  disableTabSync?: boolean;
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

interface UseProposalStatusStreamReturn {
  status: ProposalStatus | null;
  isPolling: boolean;
  pollCount: number;
  errorMessage: string;
  start: () => void;
  stop: () => void;
}

export function useProposalStatusStream(
  options: UseProposalStatusStreamOptions
): UseProposalStatusStreamReturn {
  const {
    proposalId,
    autoStart = true,
    disableTabSync = false,
    onStatusUpdate,
    onCompleted,
    onFailed,
    onCancelled,
    onError,
  } = options;

  logger.debug("[useProposalStatusStream] Hook initialized:", { proposalId, autoStart, disableTabSync, isValid: !isNaN(proposalId) && proposalId > 0 });

  // Don't start polling if proposalId is invalid
  if (isNaN(proposalId) || proposalId <= 0) {
    logger.error("[useProposalStatusStream] Invalid proposalId, polling will not start:", proposalId);
    return {
      status: null,
      errorMessage: "Invalid proposal ID",
      isPolling: false,
      pollCount: 0,
      start: () => {},
      stop: () => {},
    };
  }

  const [status, setStatus] = useState<ProposalStatus | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [pollCount, setPollCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef<number>(0);
  const stoppedRef = useRef<boolean>(false);
  const pollingStartedRef = useRef<boolean>(false);
  const pollingInstanceIdRef = useRef<string>(Math.random().toString(36).substring(7));

  // Use refs for callbacks to prevent dependency chain re-renders
  const onStatusUpdateRef = useRef(onStatusUpdate);
  const onCompletedRef = useRef(onCompleted);
  const onFailedRef = useRef(onFailed);
  const onCancelledRef = useRef(onCancelled);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onStatusUpdateRef.current = onStatusUpdate;
    onCompletedRef.current = onCompleted;
    onFailedRef.current = onFailed;
    onCancelledRef.current = onCancelled;
    onErrorRef.current = onError;
  }, [onStatusUpdate, onCompleted, onFailed, onCancelled, onError]);

  // Tab synchronization
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isLeaderRef = useRef<boolean>(false);
  const lastLeaderHeartbeatRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leaderCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    logger.debug("[useProposalStatusStream] STOP called - clearing all timers and intervals. Instance:", pollingInstanceIdRef.current);
    stoppedRef.current = true;
    pollingStartedRef.current = false;

    // Clear polling timer
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
      logger.debug("[useProposalStatusStream] Cleared poll timer");
    }

    // Clear heartbeat timers
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
      logger.debug("[useProposalStatusStream] Cleared heartbeat timer");
    }
    if (leaderCheckTimerRef.current) {
      clearInterval(leaderCheckTimerRef.current);
      leaderCheckTimerRef.current = null;
      logger.debug("[useProposalStatusStream] Cleared leader check timer");
    }

    // Close broadcast channel
    if (channelRef.current) {
      channelRef.current.close();
      channelRef.current = null;
      logger.debug("[useProposalStatusStream] Closed broadcast channel");
    }

    isLeaderRef.current = false;
    setIsPolling(false);
    logger.debug("[useProposalStatusStream] STOP completed");
  }, []);

  const handleStatusData = useCallback(
    (data: ProposalStatus) => {
      // If status is "draft" but no progress data, add default values to show activity
      if (data.status === "draft" && data.progressPercent === 0) {
        data = {
          ...data,
          progressPercent: 1, // Show small progress to indicate activity
          generatingSection: "Initializing generation...",
        };
      }

      setStatus(data);
      onStatusUpdateRef.current?.(data);

      logger.debug("[useProposalStatusStream] Status received:", {
        status: data.status,
        willContinuePolling: data.status === "in_progress" || data.status === "pending" || data.status === "generating" || data.status === "draft",
        progressPercent: data.progressPercent,
        completedSections: data.completedSections.length,
        totalSections: data.totalSections,
        generatingSection: data.generatingSection,
      });

      if (data.status === "completed") {
        logger.debug("[useProposalStatusStream] Status is completed, stopping polling");
        stop();
        onCompletedRef.current?.(data);
        return;
      }

      if (data.status === "failed") {
        logger.debug("[useProposalStatusStream] Status is failed, stopping polling");
        stop();
        setErrorMessage("Proposal generation failed. Please go back and try again.");
        onFailedRef.current?.(data);
        return;
      }

      if (data.status === "cancelled") {
        logger.debug("[useProposalStatusStream] Status is cancelled, stopping polling");
        stop();
        onCancelledRef.current?.();
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
    
    logger.debug("[useProposalStatusStream] This tab became the polling leader");
    
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
    
    logger.debug("[useProposalStatusStream] This tab resigned leadership");
  }, []);

  // ── Polling ──────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    if (stoppedRef.current) {
      logger.debug("[useProposalStatusStream] Polling stopped, skipping");
      return;
    }

    // Skip leader check if tab sync is disabled
    if (!disableTabSync && !isLeaderRef.current) {
      logger.debug("[useProposalStatusStream] Skipping poll - not leader");
      return;
    }

    try {
      logger.debug("[useProposalStatusStream] Polling status for proposal:", proposalId, "Poll count:", pollCountRef.current + 1, "Instance:", pollingInstanceIdRef.current);
      const data = await getProposalStatus(proposalId);
      logger.debug("[useProposalStatusStream] Poll response:", {
        status: data.status,
        progressPercent: data.progressPercent,
        completedSections: data.completedSections.length,
        totalSections: data.totalSections,
        generatingSection: data.generatingSection,
        currentStage: data.currentStage,
      });
      handleStatusData(data);

      // Broadcast status to other tabs (only if tab sync is enabled)
      if (!disableTabSync && channelRef.current) {
        channelRef.current.postMessage({ type: "status", data });
      }

      // If still in progress, schedule next poll
      if (data.status === "in_progress" || data.status === "pending" || data.status === "generating" || data.status === "draft") {
        pollCountRef.current += 1;
        setPollCount(pollCountRef.current);

        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          setErrorMessage(
            "Generation is taking longer than expected. Please check back in a moment."
          );
          stop();
          return;
        }

        logger.debug("[useProposalStatusStream] Scheduling next poll in", POLLING_INTERVAL_MS, "ms", "Poll count:", pollCountRef.current, "Instance:", pollingInstanceIdRef.current);
        pollTimerRef.current = setTimeout(poll, POLLING_INTERVAL_MS);
      } else {
        logger.debug("[useProposalStatusStream] Status not in progress, stopping polling. Status:", data.status, "Instance:", pollingInstanceIdRef.current);
        stop();
      }
    } catch (error) {
      logger.error("[useProposalStatusStream] Polling error:", error, "Instance:", pollingInstanceIdRef.current);
      onErrorRef.current?.(error as Error);
      // Don't stop on error - continue polling to see if it recovers
      pollCountRef.current += 1;
      setPollCount(pollCountRef.current);

      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        setErrorMessage(
          "Generation is taking longer than expected. Please check back in a moment."
        );
        stop();
        return;
      }

      // Schedule next poll even on error
      logger.debug("[useProposalStatusStream] Scheduling next poll after error in", POLLING_INTERVAL_MS, "ms", "Instance:", pollingInstanceIdRef.current);
      pollTimerRef.current = setTimeout(poll, POLLING_INTERVAL_MS);
    }
  }, [proposalId, handleStatusData, stop, disableTabSync, POLLING_INTERVAL_MS, MAX_POLL_ATTEMPTS]);

  const start = useCallback(() => {
    if (pollingStartedRef.current) {
      logger.debug("[useProposalStatusStream] Polling already started, skipping duplicate start. Instance:", pollingInstanceIdRef.current);
      return;
    }
    logger.debug("[useProposalStatusStream] Starting polling for proposal:", proposalId, "Instance:", pollingInstanceIdRef.current);
    pollingStartedRef.current = true;
    stoppedRef.current = false;
    setErrorMessage("");
    setPollCount(0);
    pollCountRef.current = 0;
    setIsPolling(true);
    void poll();
  }, [poll]);

  // Initialize BroadcastChannel for tab synchronization (skip if disabled)
  useEffect(() => {
    if (disableTabSync) {
      logger.debug("[useProposalStatusStream] Tab sync disabled, skipping BroadcastChannel setup. Instance:", pollingInstanceIdRef.current);
      // Immediately become leader so polling can start
      isLeaderRef.current = true;
      return;
    }

    const channelName = `proposal-status-${proposalId}`;

    try {
      channelRef.current = new BroadcastChannel(channelName);
      logger.debug("[useProposalStatusStream] BroadcastChannel created:", channelName, "Instance:", pollingInstanceIdRef.current);

      // Listen for messages from other tabs
      channelRef.current.onmessage = (event) => {
        const { type, data, timestamp } = event.data;

        if (type === "heartbeat") {
          // Another tab is the leader
          lastLeaderHeartbeatRef.current = timestamp;

          // If we were leader, resign
          if (isLeaderRef.current) {
            logger.debug("[useProposalStatusStream] Another tab is leader, resigning. Instance:", pollingInstanceIdRef.current);
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
          logger.debug("[useProposalStatusStream] No leader detected, claiming leadership. Instance:", pollingInstanceIdRef.current);
          becomeLeader();

          // Start polling if we should be polling
          if (autoStart && !stoppedRef.current) {
            logger.debug("[useProposalStatusStream] Starting poll after claiming leadership. Instance:", pollingInstanceIdRef.current);
            void poll();
          }
        }
      }, 1000);

      // Initially try to become leader (first tab wins)
      setTimeout(() => {
        if (!isLeaderRef.current) {
          logger.debug("[useProposalStatusStream] Initially trying to become leader. Instance:", pollingInstanceIdRef.current);
          becomeLeader();
        }
      }, 100);

    } catch (error) {
      logger.warn("[useProposalStatusStream] BroadcastChannel not supported, tab sync disabled", error);
      // Fallback: just become leader if BroadcastChannel isn't supported
      becomeLeader();
    }

    return () => {
      logger.debug("[useProposalStatusStream] Cleaning up BroadcastChannel. Instance:", pollingInstanceIdRef.current);
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
  }, [proposalId, becomeLeader, resignLeadership, handleStatusData, autoStart, poll, disableTabSync]);

  // Auto-start - run immediately on mount
  useEffect(() => {
    logger.debug("[useProposalStatusStream] Auto-start useEffect running, autoStart:", autoStart, "Instance:", pollingInstanceIdRef.current);
    if (autoStart) {
      logger.debug("[useProposalStatusStream] Auto-start enabled, calling start() immediately. Instance:", pollingInstanceIdRef.current);
      start();
    }
    return () => {
      logger.debug("[useProposalStatusStream] Component unmounting, stopping polling. Instance:", pollingInstanceIdRef.current);
      stop();
    };
  }, [autoStart, start, stop, proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    isPolling,
    pollCount,
    errorMessage,
    start,
    stop,
  };
}
