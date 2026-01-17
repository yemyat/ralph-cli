// src/tui/hooks/use-session-polling.ts
// Polls project sessions and tracks the running session

import { useCallback, useEffect, useState } from "react";
import type { RalphSession } from "../../types";
import { TIMING } from "../lib/constants";

export interface SessionPollingOptions {
  /** Custom function to get sessions (for testing) */
  getSessions?: (projectPath: string) => Promise<RalphSession[]>;
  /** Polling interval in ms (default: 2000) */
  pollIntervalMs?: number;
}

export interface SessionPollingState {
  /** The currently running session, or null if none */
  runningSession: RalphSession | null;
  /** Whether the hook is actively polling */
  isPolling: boolean;
  /** Manually reload the session */
  reloadSession: () => Promise<void>;
  /** Update the running session (for local state changes) */
  setRunningSession: (session: RalphSession | null) => void;
}

/**
 * Hook for polling project sessions and tracking the running session.
 *
 * @param projectPath - Path to the project root
 * @param options - Configuration options
 * @returns Session polling state and handlers
 */
export function useSessionPolling(
  projectPath: string,
  options: SessionPollingOptions = {}
): SessionPollingState {
  const { getSessions, pollIntervalMs = TIMING.POLL_INTERVAL_MS } = options;

  const [runningSession, setRunningSession] = useState<RalphSession | null>(
    null
  );
  const [isPolling, setIsPolling] = useState(false);

  // Load running session from project
  const loadRunningSession = useCallback(async (): Promise<void> => {
    try {
      // Use provided getSessions or dynamically import the real one
      const fetchSessions =
        getSessions ??
        (async (path: string) => {
          const { getProjectSessions } = await import("../../config");
          return getProjectSessions(path);
        });

      const sessions = await fetchSessions(projectPath);
      const running = sessions.find((s) => s.status === "running");
      setRunningSession(running || null);
    } catch {
      // Ignore errors loading session
    }
  }, [projectPath, getSessions]);

  // Initial load + polling
  useEffect(() => {
    // Start polling
    setIsPolling(true);
    loadRunningSession();

    const intervalId = setInterval(loadRunningSession, pollIntervalMs);

    return () => {
      clearInterval(intervalId);
      setIsPolling(false);
    };
  }, [loadRunningSession, pollIntervalMs]);

  return {
    runningSession,
    isPolling,
    reloadSession: loadRunningSession,
    setRunningSession,
  };
}
