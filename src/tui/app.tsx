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
import { TIMING, TOKYO_NIGHT } from "./lib/constants";
import { LoadingSpinner } from "./loading-spinner";
import { Sidebar } from "./sidebar";
import { TaskDetail } from "./task-detail";
import type { ParsedPlan, Task, VimMode } from "./types";
import {
  appendToLog,
  getLatestSessionLog,
  markTaskAsStopped,
  parseImplementationPlan,
  readSpecContent,
} from "./utils";

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [specContent, setSpecContent] = useState("");
  const [logPath, setLogPath] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Vim keybindings state
  const [mode, setMode] = useState<VimMode>("normal");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<Task[]>([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [commandBuffer, setCommandBuffer] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const lastKeyRef = useRef<{ key: string; time: number }>({
    key: "",
    time: 0,
  });

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

  // Get all tasks flattened
  const getAllTasks = useCallback((): Task[] => {
    return [
      ...plan.inProgress,
      ...plan.stopped,
      ...plan.backlog,
      ...plan.completed,
    ];
  }, [plan]);

  // Update search matches when query changes
  useEffect(() => {
    if (searchQuery.length > 0) {
      const allTasks = getAllTasks();
      const matches = allTasks.filter((task) =>
        task.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchMatches(matches);
      setSearchMatchIndex(0);
    } else {
      setSearchMatches([]);
      setSearchMatchIndex(0);
    }
  }, [searchQuery, getAllTasks]);

  // Load implementation plan
  useEffect(() => {
    const loadPlan = async (): Promise<void> => {
      try {
        const parsedPlan = await parseImplementationPlan(projectPath);
        setPlan(parsedPlan);

        // Select first task from visible list
        const firstTask =
          parsedPlan.inProgress[0] ||
          parsedPlan.stopped[0] ||
          parsedPlan.backlog[0];
        if (firstTask) {
          setSelectedTask(firstTask);
          setSelectedIndex(0);
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

  // Navigate to a specific task in the flat list
  const navigateToTask = useCallback(
    (task: Task) => {
      const tasks = getVisibleTasks();
      const index = tasks.findIndex((t) => t.id === task.id);
      if (index !== -1) {
        setSelectedIndex(index);
        setSelectedTask(task);
      }
    },
    [getVisibleTasks]
  );

  // Select current search match
  const selectSearchMatch = useCallback(() => {
    if (searchMatches.length > 0 && searchMatchIndex < searchMatches.length) {
      const match = searchMatches[searchMatchIndex];
      navigateToTask(match);
      setMode("normal");
      setSearchQuery("");
    }
  }, [searchMatches, searchMatchIndex, navigateToTask]);

  // Jump to first/last item in the task list
  const jumpToFirst = useCallback(() => {
    const tasks = getVisibleTasks();
    if (tasks.length > 0) {
      setSelectedIndex(0);
      setSelectedTask(tasks[0]);
    }
  }, [getVisibleTasks]);

  const jumpToLast = useCallback(() => {
    const tasks = getVisibleTasks();
    const lastTask = tasks.at(-1);
    if (tasks.length > 0 && lastTask) {
      setSelectedIndex(tasks.length - 1);
      setSelectedTask(lastTask);
    }
  }, [getVisibleTasks]);

  // Handle gg double-tap detection
  const handleDoubleTapG = useCallback((): boolean => {
    const now = Date.now();
    const lastKey = lastKeyRef.current;
    if (lastKey.key === "g" && now - lastKey.time < TIMING.DOUBLE_TAP_MS) {
      jumpToFirst();
      lastKeyRef.current = { key: "", time: 0 };
      return true;
    }
    lastKeyRef.current = { key: "g", time: now };
    return true;
  }, [jumpToFirst]);

  // Handle search match navigation
  const handleSearchMatchNav = useCallback(
    (direction: "next" | "prev"): boolean => {
      if (searchMatches.length === 0) {
        return false;
      }
      const newIndex =
        direction === "next"
          ? (searchMatchIndex + 1) % searchMatches.length
          : (searchMatchIndex - 1 + searchMatches.length) %
            searchMatches.length;
      setSearchMatchIndex(newIndex);
      navigateToTask(searchMatches[newIndex]);
      return true;
    },
    [searchMatches, searchMatchIndex, navigateToTask]
  );

  // Handle vertical navigation
  const handleVerticalNav = useCallback(
    (direction: "up" | "down"): boolean => {
      const tasks = getVisibleTasks();
      if (direction === "up" && selectedIndex > 0) {
        const newIndex = selectedIndex - 1;
        setSelectedIndex(newIndex);
        setSelectedTask(tasks[newIndex]);
        return true;
      }
      if (direction === "down" && selectedIndex < tasks.length - 1) {
        const newIndex = selectedIndex + 1;
        setSelectedIndex(newIndex);
        setSelectedTask(tasks[newIndex]);
        return true;
      }
      return false;
    },
    [selectedIndex, getVisibleTasks]
  );

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

  // Handle single-character mode/action keys
  const handleSingleCharKey = useCallback(
    (input: string): boolean => {
      switch (input) {
        case "?":
          setShowHelp(true);
          return true;
        case "/":
          setMode("search");
          setSearchQuery("");
          return true;
        case ":":
          setMode("command");
          setCommandBuffer(":");
          return true;
        case "G":
          jumpToLast();
          return true;
        case "n":
          handleSearchMatchNav("next");
          return true;
        case "N":
          handleSearchMatchNav("prev");
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
    [jumpToLast, handleSearchMatchNav, handleStopKey, toggleCompleted]
  );

  // Handle movement keys (arrows, jk)
  const handleMovementKeys = useCallback(
    (
      input: string,
      key: {
        isUpArrow?: boolean;
        isDownArrow?: boolean;
      }
    ): boolean => {
      // Vertical navigation
      if (key.isUpArrow || input === "k") {
        return handleVerticalNav("up");
      }
      if (key.isDownArrow || input === "j") {
        return handleVerticalNav("down");
      }

      return false;
    },
    [handleVerticalNav]
  );

  // Handle sidebar navigation in normal mode
  const handleNormalModeInput = useCallback(
    (
      input: string,
      key: {
        isUpArrow?: boolean;
        isDownArrow?: boolean;
        ctrl?: boolean;
        isEscape?: boolean;
      }
    ) => {
      // Check for gg (double-tap g)
      if (input === "g") {
        handleDoubleTapG();
        return;
      }

      // Clear last key on any other input
      lastKeyRef.current = { key: "", time: 0 };

      // Single-character mode/action keys
      if (handleSingleCharKey(input)) {
        return;
      }

      // Ctrl+C to quit
      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      // Movement keys
      if (handleMovementKeys(input, key)) {
        return;
      }

      // Quit (only if no search matches)
      if (input === "q" && searchMatches.length === 0) {
        exit();
      }
    },
    [
      exit,
      searchMatches,
      handleDoubleTapG,
      handleSingleCharKey,
      handleMovementKeys,
    ]
  );

  // Handle search mode input
  const handleSearchModeInput = useCallback(
    (
      input: string,
      key: {
        isReturn?: boolean;
        isEscape?: boolean;
        isBackspace?: boolean;
        isDelete?: boolean;
      }
    ) => {
      // Cancel search
      if (key.isEscape) {
        setMode("normal");
        setSearchQuery("");
        return;
      }

      // Select current match
      if (key.isReturn) {
        selectSearchMatch();
        return;
      }

      // Backspace
      if (key.isBackspace || key.isDelete) {
        setSearchQuery((prev) => prev.slice(0, -1));
        return;
      }

      // Add character to search query
      if (input.length === 1 && input.charCodeAt(0) >= 32) {
        setSearchQuery((prev) => prev + input);
      }
    },
    [selectSearchMatch]
  );

  // Handle command mode input
  const handleCommandModeInput = useCallback(
    (
      input: string,
      key: {
        isReturn?: boolean;
        isEscape?: boolean;
        isBackspace?: boolean;
        isDelete?: boolean;
      }
    ) => {
      // Cancel command
      if (key.isEscape) {
        setMode("normal");
        setCommandBuffer("");
        return;
      }

      // Execute command
      if (key.isReturn) {
        if (commandBuffer === ":q" || commandBuffer === ":quit") {
          exit();
        }
        setMode("normal");
        setCommandBuffer("");
        return;
      }

      // Backspace
      if (key.isBackspace || key.isDelete) {
        if (commandBuffer.length > 1) {
          setCommandBuffer((prev) => prev.slice(0, -1));
        } else {
          setMode("normal");
          setCommandBuffer("");
        }
        return;
      }

      // Add character to command
      if (input.length === 1 && input.charCodeAt(0) >= 32) {
        setCommandBuffer((prev) => prev + input);
      }
    },
    [exit, commandBuffer]
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
    (
      input: string,
      key: {
        isUpArrow?: boolean;
        isDownArrow?: boolean;
        ctrl?: boolean;
        isEscape?: boolean;
        isBackspace?: boolean;
        isDelete?: boolean;
        isReturn?: boolean;
      }
    ) => {
      // Handle dialogs and overlays first
      if (handleForceKillDialogInput(input, key.isEscape ?? false)) {
        return;
      }
      if (handleStopDialogInput(input, key.isEscape ?? false)) {
        return;
      }
      if (handleHelpOverlayInput(input, key.isEscape ?? false)) {
        return;
      }

      // Route to mode-specific handler
      switch (mode) {
        case "search":
          handleSearchModeInput(input, key);
          break;
        case "command":
          handleCommandModeInput(input, key);
          break;
        default:
          handleNormalModeInput(input, key);
      }
    },
    [
      mode,
      handleForceKillDialogInput,
      handleStopDialogInput,
      handleHelpOverlayInput,
      handleNormalModeInput,
      handleSearchModeInput,
      handleCommandModeInput,
    ]
  );

  // Keyboard input handling
  useKeyboard((keyEvent) => {
    const key = {
      isUpArrow: keyEvent.name === "up",
      isDownArrow: keyEvent.name === "down",
      isReturn: keyEvent.name === "return",
      isEscape: keyEvent.name === "escape",
      isBackspace: keyEvent.name === "backspace",
      isDelete: keyEvent.name === "delete",
      ctrl: keyEvent.ctrl,
    };
    const input = keyEvent.sequence || "";
    handleMainInput(input, key);
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
          <span fg={TOKYO_NIGHT.fg}>{searchQuery}</span>
          <span fg={TOKYO_NIGHT.comment}>_</span>
          {searchMatches.length > 0 && (
            <span fg={TOKYO_NIGHT.comment}>
              {" "}
              ({searchMatchIndex + 1}/{searchMatches.length})
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
