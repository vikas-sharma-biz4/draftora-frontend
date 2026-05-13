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

    isLeaderRef.current = false;
    setIsPolling(false);
  }, []);

  const handleStatusData = useCallback(
    (data: ProposalStatus) => {
      setStatus(data);
      onStatusUpdate?.(data);

      if (data.status === "completed") {
        stop();
        onCompleted?.(data);
        return;
      }

      if (data.status === "failed") {
        stop();
        setErrorMessage("Proposal generation failed. Please go back and try again.");
        onFailed?.(data);
        return;
      }

      if (data.status === "cancelled") {
        stop();
        onCancelled?.();
        return;
      }
    },
    [onStatusUpdate, onCompleted, onFailed, onCancelled, stop]
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
    if (stoppedRef.current) return;
    
    // Only poll if this tab is the leader
    if (!isLeaderRef.current) {
      logger.debug("[useProposalStatusStream] Skipping poll - not leader");
      return;
    }

    try {
      const data = await getProposalStatus(proposalId);
      handleStatusData(data);
      
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
      logger.error("[useProposalStatusStream] Polling error:", error);
      onError?.(error as Error);
      stop();
    }
  }, [proposalId, handleStatusData, onError, stop]);

  const start = useCallback(() => {
    stoppedRef.current = false;
    setErrorMessage("");
    setPollCount(0);
    pollCountRef.current = 0;
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
          logger.debug("[useProposalStatusStream] No leader detected, claiming leadership");
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
        }
      }, 100);
      
    } catch (error) {
      logger.warn("[useProposalStatusStream] BroadcastChannel not supported, tab sync disabled", error);
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
