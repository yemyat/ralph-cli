// src/tui/hooks/use-task-manager.ts
// Manages task lifecycle: stopping, force-killing, and confirmation dialogs

import { useCallback, useEffect, useRef, useState } from "react";
import type { RalphSession } from "../../types";
import { TIMING } from "../lib/constants";
import type { Task } from "../types";

export type ConfirmState = "confirm-stop" | "force-kill" | null;

export interface TaskManagerOptions {
  /** Project path for file operations */
  projectPath: string;
  /** Current running session (from useSessionPolling) */
  runningSession: RalphSession | null;
  /** Current log file path */
  logPath: string | null;
  /** Callback when task is stopped (to reload plan) */
  onTaskStopped?: () => Promise<void>;
  /** Callback to update running session state */
  onSessionUpdate?: (session: RalphSession | null) => void;
  /** Graceful shutdown timeout in ms (default: 5000) */
  gracefulTimeoutMs?: number;
}

export interface TaskManagerState {
  /** Current confirmation dialog state */
  confirmState: ConfirmState;
  /** Task being stopped */
  taskToStop: Task | null;
  /** ID of task currently in stopping state (for UI spinner) */
  stoppingTaskId: string | null;
}

export interface TaskManagerHandlers {
  /** Initiate stop action - shows confirmation dialog */
  initiateStop: (task: Task) => void;
  /** Confirm stop - sends SIGTERM and starts timeout */
  confirmStop: () => Promise<void>;
  /** Force kill - sends SIGKILL */
  forceKill: () => Promise<void>;
  /** Cancel stop action */
  cancelStop: () => void;
}

export interface TaskManagerResult extends TaskManagerState, TaskManagerHandlers {}

/**
 * Hook for managing task lifecycle: stopping, force-killing, and confirmation dialogs.
 *
 * Flow:
 * 1. initiateStop(task) -> shows confirm-stop dialog
 * 2. confirmStop() -> sends SIGTERM, starts 5s timeout
 * 3. After timeout, if process still alive -> shows force-kill dialog
 * 4. forceKill() -> sends SIGKILL
 *
 * @param options - Configuration options
 * @returns Task manager state and handlers
 */
export function useTaskManager(options: TaskManagerOptions): TaskManagerResult {
  const {
    projectPath,
    runningSession,
    logPath,
    onTaskStopped,
    onSessionUpdate,
    gracefulTimeoutMs = TIMING.GRACEFUL_SHUTDOWN_MS,
  } = options;

  // Dialog state
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [taskToStop, setTaskToStop] = useState<Task | null>(null);
  const [stoppingTaskId, setStoppingTaskId] = useState<string | null>(null);

  // Timeout ref for graceful shutdown
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
    };
  }, []);

  // Send signal to process
  const sendSignal = useCallback(
    (pid: number, signal: "SIGTERM" | "SIGKILL" | 0): boolean => {
      try {
        process.kill(pid, signal);
        return true;
      } catch (err) {
        // ESRCH = process doesn't exist (already dead)
        const errno = (err as NodeJS.ErrnoException).code;
        if (errno === "ESRCH") {
          return false;
        }
        // Other errors - process might still be alive
        throw err;
      }
    },
    []
  );

  // Check if process is still running
  const isProcessAlive = useCallback(
    (pid: number): boolean => {
      try {
        // Signal 0 checks if process exists without sending a signal
        return sendSignal(pid, 0);
      } catch {
        return false;
      }
    },
    [sendSignal]
  );

  // Complete the stop process
  const completeStop = useCallback(
    async (task: Task, wasForceKilled: boolean): Promise<void> => {
      // Dynamically import to avoid circular dependencies
      const { saveSession } = await import("../../config");
      const { appendToLog, markTaskAsStopped } = await import(
        "../lib/file-operations"
      );

      // Update session status
      if (runningSession) {
        const updatedSession: RalphSession = {
          ...runningSession,
          status: "stopped",
          stoppedAt: new Date().toISOString(),
        };
        await saveSession(projectPath, updatedSession);
        onSessionUpdate?.(updatedSession);
      }

      // Mark task as stopped in implementation plan
      await markTaskAsStopped(projectPath, task.specPath);

      // Append termination message to log
      if (logPath) {
        const message = wasForceKilled
          ? "Task force-killed by user (SIGKILL)"
          : "Task stopped by user (SIGTERM)";
        await appendToLog(logPath, message);
      }

      // Reset stop state
      setStoppingTaskId(null);
      setConfirmState(null);
      setTaskToStop(null);

      // Notify parent to reload plan
      await onTaskStopped?.();
    },
    [projectPath, runningSession, logPath, onTaskStopped, onSessionUpdate]
  );

  // Initiate stop action - show confirmation dialog
  const initiateStop = useCallback((task: Task): void => {
    if (task.status !== "in_progress") {
      return;
    }
    setTaskToStop(task);
    setConfirmState("confirm-stop");
  }, []);

  // Cancel stop action
  const cancelStop = useCallback((): void => {
    setConfirmState(null);
    setTaskToStop(null);
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  // Confirm stop - send SIGTERM and start timeout
  const confirmStop = useCallback(async (): Promise<void> => {
    if (!taskToStop) {
      return;
    }

    setConfirmState(null);
    setStoppingTaskId(taskToStop.id);

    const { appendToLog } = await import("../lib/file-operations");

    // Try to send SIGTERM to the running process
    if (runningSession?.pid) {
      try {
        sendSignal(runningSession.pid, "SIGTERM");
        if (logPath) {
          await appendToLog(logPath, "Sending SIGTERM to process...");
        }
      } catch {
        // Process might already be terminated
        await completeStop(taskToStop, false);
        return;
      }
    }

    // Start timeout for graceful shutdown
    const capturedTask = taskToStop;
    const capturedPid = runningSession?.pid;

    stopTimeoutRef.current = setTimeout(async () => {
      // Check if process is still running
      if (capturedPid && isProcessAlive(capturedPid)) {
        // Process still running - show force kill dialog
        setConfirmState("force-kill");
      } else {
        // Process already terminated
        await completeStop(capturedTask, false);
      }
    }, gracefulTimeoutMs);
  }, [
    taskToStop,
    runningSession,
    logPath,
    gracefulTimeoutMs,
    sendSignal,
    isProcessAlive,
    completeStop,
  ]);

  // Force kill - send SIGKILL
  const forceKill = useCallback(async (): Promise<void> => {
    if (!taskToStop) {
      return;
    }

    if (runningSession?.pid) {
      try {
        sendSignal(runningSession.pid, "SIGKILL");
      } catch {
        // Process might already be terminated
      }
    }

    await completeStop(taskToStop, true);
  }, [taskToStop, runningSession, sendSignal, completeStop]);

  return {
    // State
    confirmState,
    taskToStop,
    stoppingTaskId,
    // Handlers
    initiateStop,
    confirmStop,
    forceKill,
    cancelStop,
  };
}
