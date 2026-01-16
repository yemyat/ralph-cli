import {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getProjectSessions, saveSession } from "../config";
import type { RalphSession } from "../types";
import { ConfirmDialog } from "./confirm-dialog";
import { HelpOverlay } from "./help-overlay";
import {
  type KeyEvent,
  useKeyboardNavigation,
} from "./hooks/use-keyboard-navigation";
import { TIMING, TOKYO_NIGHT } from "./lib/constants";
import {
  appendToLog,
  getLatestSessionLog,
  markTaskAsStopped,
  parseImplementationPlan,
  readSpecContent,
} from "./lib/file-operations";
import { LoadingSpinner } from "./loading-spinner";
import { Sidebar } from "./sidebar";
import { TaskDetail } from "./task-detail";
import type { ParsedPlan, Task } from "./types";

interface AppProps {
  projectPath: string;
}

export function App({ projectPath }: AppProps): React.ReactNode {
  const renderer = useRenderer();
  const { width: terminalWidth, height: terminalHeight } =
    useTerminalDimensions();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ParsedPlan>({
    inProgress: [],
    backlog: [],
    completed: [],
    stopped: [],
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [specContent, setSpecContent] = useState("");
  const [logPath, setLogPath] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Detail scroll state
  const [detailScrollOffset, setDetailScrollOffset] = useState(0);

  // Stop task state
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showForceKillConfirm, setShowForceKillConfirm] = useState(false);
  const [taskToStop, setTaskToStop] = useState<Task | null>(null);
  const [stoppingTaskId, setStoppingTaskId] = useState<string | null>(null);
  const [runningSession, setRunningSession] = useState<RalphSession | null>(
    null
  );
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Exit function
  const exit = useCallback(() => {
    renderer.destroy();
    process.exit(0);
  }, [renderer]);

  // Get visible task list for navigation (in_progress -> backlog/stopped -> completed if shown)
  const getVisibleTasks = useCallback((): Task[] => {
    const tasks: Task[] = [
      ...plan.inProgress,
      ...plan.stopped,
      ...plan.backlog,
    ];
    if (showCompleted) {
      tasks.push(...plan.completed);
    }
    return tasks;
  }, [plan, showCompleted]);

  // Keyboard navigation hook
  const visibleTasks = getVisibleTasks();
  const {
    mode,
    selectedIndex,
    searchState,
    commandBuffer,
    handlers: navHandlers,
  } = useKeyboardNavigation(visibleTasks, {
    onExit: exit,
  });

  // Sync selectedTask with hook's selectedIndex
  useEffect(() => {
    const task = visibleTasks[selectedIndex];
    if (task && task.id !== selectedTask?.id) {
      setSelectedTask(task);
    }
  }, [selectedIndex, visibleTasks, selectedTask?.id]);

  // Load implementation plan
  useEffect(() => {
    const loadPlan = async (): Promise<void> => {
      try {
        const parsedPlan = await parseImplementationPlan(projectPath);
        setPlan(parsedPlan);

        // Select first task from visible list (hook initializes at index 0)
        const firstTask =
          parsedPlan.inProgress[0] ||
          parsedPlan.stopped[0] ||
          parsedPlan.backlog[0];
        if (firstTask) {
          setSelectedTask(firstTask);
        }

        // Get latest log file path
        const latestLog = await getLatestSessionLog(projectPath);
        setLogPath(latestLog);

        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load implementation plan"
        );
        setLoading(false);
      }
    };
    loadPlan();
  }, [projectPath]);

  // Load spec content when a task is selected
  useEffect(() => {
    if (!selectedTask) {
      setSpecContent("");
      return;
    }

    const loadSpec = async (): Promise<void> => {
      const content = await readSpecContent(projectPath, selectedTask.specPath);
      setSpecContent(content);
      setDetailScrollOffset(0);
    };
    loadSpec();
  }, [selectedTask, projectPath]);

  // Load running session (for stop functionality)
  useEffect(() => {
    const loadRunningSession = async (): Promise<void> => {
      try {
        const sessions = await getProjectSessions(projectPath);
        const running = sessions.find((s) => s.status === "running");
        setRunningSession(running || null);
      } catch {
        // Ignore errors loading session
      }
    };
    loadRunningSession();

    // Poll for session status
    const intervalId = setInterval(loadRunningSession, TIMING.POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [projectPath]);

  // Cleanup stop timeout on unmount
  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
    };
  }, []);

  // Initiate stop action - show confirmation dialog
  const initiateStop = useCallback((task: Task): void => {
    if (task.status !== "in_progress") {
      return;
    }
    setTaskToStop(task);
    setShowStopConfirm(true);
  }, []);

  // Cancel stop action - hide dialogs and reset state
  const cancelStop = useCallback((): void => {
    setShowStopConfirm(false);
    setShowForceKillConfirm(false);
    setTaskToStop(null);
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  // Complete the stop process - mark task as stopped and update plan
  const completeStop = useCallback(
    async (task: Task, wasForceKilled: boolean): Promise<void> => {
      // Update session status
      if (runningSession) {
        runningSession.status = "stopped";
        runningSession.stoppedAt = new Date().toISOString();
        await saveSession(projectPath, runningSession);
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

      // Reload the plan to reflect changes
      const parsedPlan = await parseImplementationPlan(projectPath);
      setPlan(parsedPlan);

      // Reset stop state
      setStoppingTaskId(null);
      setShowForceKillConfirm(false);
      setTaskToStop(null);
    },
    [projectPath, runningSession, logPath]
  );

  // Confirm stop - send SIGTERM and start timeout
  const confirmStop = useCallback(async (): Promise<void> => {
    if (!taskToStop) {
      return;
    }

    setShowStopConfirm(false);
    setStoppingTaskId(taskToStop.id);

    // Try to send SIGTERM to the running process
    if (runningSession?.pid) {
      try {
        process.kill(runningSession.pid, "SIGTERM");
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
    stopTimeoutRef.current = setTimeout(async () => {
      // Check if process is still running
      if (runningSession?.pid) {
        try {
          // Sending signal 0 checks if process exists without sending a signal
          process.kill(runningSession.pid, 0);
          // Process still running - show force kill dialog
          setShowForceKillConfirm(true);
        } catch {
          // Process already terminated
          if (taskToStop) {
            await completeStop(taskToStop, false);
          }
        }
      } else if (taskToStop) {
        await completeStop(taskToStop, false);
      }
    }, TIMING.GRACEFUL_SHUTDOWN_MS);
  }, [taskToStop, runningSession, logPath, completeStop]);

  // Force kill - send SIGKILL
  const forceKill = useCallback(async (): Promise<void> => {
    if (!taskToStop) {
      return;
    }

    if (runningSession?.pid) {
      try {
        process.kill(runningSession.pid, "SIGKILL");
      } catch {
        // Process might already be terminated
      }
    }

    await completeStop(taskToStop, true);
  }, [taskToStop, runningSession, completeStop]);

  // Handle stop keybindings (s or x)
  const handleStopKey = useCallback((): boolean => {
    if (selectedTask?.status === "in_progress") {
      initiateStop(selectedTask);
      return true;
    }
    return false;
  }, [selectedTask, initiateStop]);

  // Toggle completed tasks visibility
  const toggleCompleted = useCallback(() => {
    setShowCompleted((prev) => !prev);
  }, []);

  // Handle app-specific keys in normal mode (not handled by navigation hook)
  const handleAppSpecificKeys = useCallback(
    (input: string): boolean => {
      switch (input) {
        case "?":
          setShowHelp(true);
          return true;
        case "c":
          toggleCompleted();
          return true;
        case "s":
        case "x":
          return handleStopKey();
        default:
          return false;
      }
    },
    [handleStopKey, toggleCompleted]
  );

  // Handle force kill dialog input
  const handleForceKillDialogInput = useCallback(
    (input: string, isEscapeKey: boolean): boolean => {
      if (!showForceKillConfirm) {
        return false;
      }
      if (input === "y" || input === "Y") {
        forceKill();
      } else if (input === "n" || input === "N" || isEscapeKey) {
        setShowForceKillConfirm(false);
      }
      return true;
    },
    [showForceKillConfirm, forceKill]
  );

  // Handle stop confirmation dialog input
  const handleStopDialogInput = useCallback(
    (input: string, isEscapeKey: boolean): boolean => {
      if (!showStopConfirm) {
        return false;
      }
      if (input === "y" || input === "Y") {
        confirmStop();
      } else if (input === "n" || input === "N" || isEscapeKey) {
        cancelStop();
      }
      return true;
    },
    [showStopConfirm, confirmStop, cancelStop]
  );

  // Handle help overlay input
  const handleHelpOverlayInput = useCallback(
    (input: string, isEscapeKey: boolean): boolean => {
      if (!showHelp) {
        return false;
      }
      if (isEscapeKey || input === "?" || input === "q") {
        setShowHelp(false);
      }
      return true;
    },
    [showHelp]
  );

  // Handle main input (routes to mode-specific handlers)
  const handleMainInput = useCallback(
    (keyEvent: KeyEvent) => {
      const { input, isEscape } = keyEvent;

      // Handle dialogs and overlays first
      if (handleForceKillDialogInput(input, isEscape ?? false)) {
        return;
      }
      if (handleStopDialogInput(input, isEscape ?? false)) {
        return;
      }
      if (handleHelpOverlayInput(input, isEscape ?? false)) {
        return;
      }

      // In normal mode, check app-specific keys first
      if (mode === "normal" && handleAppSpecificKeys(input)) {
        return;
      }

      // Route all other input to the navigation hook
      navHandlers.handleKeyEvent(keyEvent);
    },
    [
      mode,
      handleForceKillDialogInput,
      handleStopDialogInput,
      handleHelpOverlayInput,
      handleAppSpecificKeys,
      navHandlers,
    ]
  );

  // Keyboard input handling
  useKeyboard((keyEvent) => {
    const event: KeyEvent = {
      input: keyEvent.sequence || "",
      isUpArrow: keyEvent.name === "up",
      isDownArrow: keyEvent.name === "down",
      isReturn: keyEvent.name === "return",
      isEscape: keyEvent.name === "escape",
      isBackspace: keyEvent.name === "backspace",
      isDelete: keyEvent.name === "delete",
      ctrl: keyEvent.ctrl,
    };
    handleMainInput(event);
  });

  // Loading state
  if (loading) {
    return (
      <box flexDirection="column" padding={1}>
        <text fg={TOKYO_NIGHT.blue}>
          <LoadingSpinner /> Loading Ralph Wiggum CLI...
        </text>
      </box>
    );
  }

  // Error state
  if (error) {
    return (
      <box flexDirection="column" padding={1}>
        <text fg={TOKYO_NIGHT.red}>Error: {error}</text>
        <text fg={TOKYO_NIGHT.comment}>Press q to quit.</text>
      </box>
    );
  }

  // Calculate layout
  const sidebarWidth = 30;
  const contentHeight = terminalHeight - 4;
  const totalTasks =
    plan.backlog.length +
    plan.inProgress.length +
    plan.completed.length +
    plan.stopped.length;

  // Build status bar text based on mode
  const getStatusBarContent = (): React.ReactNode => {
    if (mode === "search") {
      return (
        <text>
          <span fg={TOKYO_NIGHT.purple}>/</span>
          <span fg={TOKYO_NIGHT.fg}>{searchState.query}</span>
          <span fg={TOKYO_NIGHT.comment}>_</span>
          {searchState.matches.length > 0 && (
            <span fg={TOKYO_NIGHT.comment}>
              {" "}
              ({searchState.matchIndex + 1}/{searchState.matches.length})
            </span>
          )}
        </text>
      );
    }
    if (mode === "command") {
      return (
        <text>
          <span fg={TOKYO_NIGHT.purple}>{commandBuffer}</span>
          <span fg={TOKYO_NIGHT.comment}>_</span>
        </text>
      );
    }
    const stopHint = selectedTask?.status === "in_progress" ? "[s] stop " : "";
    const completedHint = showCompleted ? "[c] hide done" : "[c] show done";
    return (
      <text fg={TOKYO_NIGHT.comment}>
        [jk] move {stopHint}[/] search {completedHint} [?] help [:q] quit
      </text>
    );
  };

  // Show help overlay
  if (showHelp) {
    return (
      <box flexDirection="column" height={terminalHeight} width="100%">
        <HelpOverlay height={terminalHeight} width={terminalWidth} />
      </box>
    );
  }

  // Show stop confirmation dialog
  if (showStopConfirm && taskToStop) {
    return (
      <box
        alignItems="center"
        flexDirection="column"
        height={terminalHeight}
        justifyContent="center"
        width="100%"
      >
        <ConfirmDialog
          taskName={taskToStop.name}
          type="confirm-stop"
          visible={true}
        />
      </box>
    );
  }

  // Show force kill confirmation dialog
  if (showForceKillConfirm && taskToStop) {
    return (
      <box
        alignItems="center"
        flexDirection="column"
        height={terminalHeight}
        justifyContent="center"
        width="100%"
      >
        <ConfirmDialog
          taskName={taskToStop.name}
          type="force-kill"
          visible={true}
        />
      </box>
    );
  }

  return (
    <box flexDirection="column" height={terminalHeight} width="100%">
      {/* Header */}
      <box
        justifyContent="space-between"
        marginBottom={1}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={TOKYO_NIGHT.blue}>
          <strong>Ralph Wiggum CLI</strong>
        </text>
        {getStatusBarContent()}
      </box>

      {/* Main content: Sidebar + Task Detail */}
      <box flexDirection="row" flexGrow={1} paddingLeft={1} paddingRight={1}>
        {totalTasks === 0 ? (
          <box flexDirection="column" paddingBottom={2} paddingTop={2}>
            <text fg={TOKYO_NIGHT.yellow}>
              No specs found in IMPLEMENTATION_PLAN.md
            </text>
            <text fg={TOKYO_NIGHT.comment}>
              Run `ralph-wiggum-cli start plan` to generate the implementation
              plan.
            </text>
          </box>
        ) : (
          <>
            <Sidebar
              backlog={plan.backlog}
              completed={plan.completed}
              height={contentHeight}
              inProgress={plan.inProgress}
              selectedTaskId={selectedTask?.id || null}
              showCompleted={showCompleted}
              stopped={plan.stopped}
              stoppingTaskId={stoppingTaskId}
              width={sidebarWidth}
            />
            <box flexGrow={1}>
              <TaskDetail
                height={contentHeight}
                scrollOffset={detailScrollOffset}
                specContent={specContent}
                task={selectedTask}
              />
            </box>
          </>
        )}
      </box>

      {/* Footer */}
      <box marginTop={1} paddingLeft={1} paddingRight={1}>
        <text fg={TOKYO_NIGHT.comment}>
          {totalTasks} spec(s) | {plan.completed.length} completed
        </text>
      </box>
    </box>
  );
}
