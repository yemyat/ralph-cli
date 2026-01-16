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
import { DetailView, type FocusedPanel } from "./detail-view";
import { HelpOverlay } from "./help-overlay";
import { Kanban } from "./kanban";
import { LoadingSpinner } from "./loading-spinner";
import {
  appendToLog,
  getLatestSessionLog,
  markTaskAsStopped,
  type ParsedPlan,
  parseImplementationPlan,
  readLogContent,
  readSpecContent,
  type Task,
  type TaskStatus,
} from "./utils";

type View = "kanban" | "detail";
type Mode = "normal" | "search" | "command";

interface AppProps {
  projectPath: string;
}

// Timeout for detecting double-tap (gg)
const DOUBLE_TAP_TIMEOUT = 300;

const COLUMN_ORDER: TaskStatus[] = ["backlog", "in_progress", "completed"];

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
  const [view, setView] = useState<View>("kanban");
  const [activeColumn, setActiveColumn] = useState<TaskStatus>("backlog");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [specContent, setSpecContent] = useState("");
  const [logContent, setLogContent] = useState("");
  const [logPath, setLogPath] = useState<string | null>(null);

  // Vim keybindings state
  const [mode, setMode] = useState<Mode>("normal");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<Task[]>([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [commandBuffer, setCommandBuffer] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const lastKeyRef = useRef<{ key: string; time: number }>({
    key: "",
    time: 0,
  });

  // Detail view scroll state
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>("spec");
  const [specScrollOffset, setSpecScrollOffset] = useState(0);
  const [logsScrollOffset, setLogsScrollOffset] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);

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

  // Get tasks for current column
  const getTasksForColumn = useCallback(
    (column: TaskStatus): Task[] => {
      switch (column) {
        case "backlog":
          // Backlog column shows both stopped and backlog tasks
          return [...plan.stopped, ...plan.backlog];
        case "stopped":
          return plan.stopped;
        case "in_progress":
          return plan.inProgress;
        case "completed":
          return plan.completed;
        default:
          return [];
      }
    },
    [plan]
  );

  // Get all tasks flattened
  const getAllTasks = useCallback((): Task[] => {
    return [
      ...plan.backlog,
      ...plan.inProgress,
      ...plan.completed,
      ...plan.stopped,
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

        // Find the first non-empty column
        if (parsedPlan.inProgress.length > 0) {
          setActiveColumn("in_progress");
        } else if (parsedPlan.backlog.length > 0) {
          setActiveColumn("backlog");
        } else if (parsedPlan.completed.length > 0) {
          setActiveColumn("completed");
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
      return;
    }

    const loadSpec = async (): Promise<void> => {
      const content = await readSpecContent(projectPath, selectedTask.specPath);
      setSpecContent(content);
    };
    loadSpec();
  }, [selectedTask, projectPath]);

  // Load and stream log content
  useEffect(() => {
    if (!selectedTask || selectedTask.status === "backlog") {
      return;
    }
    if (!logPath) {
      setLogContent("No session logs found.");
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadLog = async (): Promise<void> => {
      const content = await readLogContent(logPath, 100);
      setLogContent(content);
    };

    loadLog();

    // Stream logs if in progress
    if (selectedTask.status === "in_progress") {
      intervalId = setInterval(loadLog, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [selectedTask, logPath]);

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

    // Poll for session status every 2 seconds
    const intervalId = setInterval(loadRunningSession, 2000);
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

  // Navigate to a different column
  const navigateColumn = useCallback(
    (direction: -1 | 1) => {
      const currentIdx = COLUMN_ORDER.indexOf(activeColumn);
      const newIdx = currentIdx + direction;
      if (newIdx >= 0 && newIdx < COLUMN_ORDER.length) {
        setActiveColumn(COLUMN_ORDER[newIdx]);
        setSelectedIndex(0);
      }
    },
    [activeColumn]
  );

  // Navigate to a specific task
  const navigateToTask = useCallback(
    (task: Task) => {
      setActiveColumn(task.status);
      const tasks = getTasksForColumn(task.status);
      const index = tasks.findIndex((t) => t.id === task.id);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    },
    [getTasksForColumn]
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

  // Jump to first/last item in current column
  const jumpToFirst = useCallback(() => {
    setSelectedIndex(0);
  }, []);

  const jumpToLast = useCallback(() => {
    const tasks = getTasksForColumn(activeColumn);
    if (tasks.length > 0) {
      setSelectedIndex(tasks.length - 1);
    }
  }, [getTasksForColumn, activeColumn]);

  // Handle gg double-tap detection
  const handleDoubleTapG = useCallback((): boolean => {
    const now = Date.now();
    const lastKey = lastKeyRef.current;
    if (lastKey.key === "g" && now - lastKey.time < DOUBLE_TAP_TIMEOUT) {
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
    (direction: "up" | "down", tasks: Task[]): boolean => {
      if (direction === "up" && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
        return true;
      }
      if (direction === "down" && selectedIndex < tasks.length - 1) {
        setSelectedIndex(selectedIndex + 1);
        return true;
      }
      return false;
    },
    [selectedIndex]
  );

  // Handle opening a task
  const handleOpenTask = useCallback(
    (tasks: Task[]): boolean => {
      if (tasks.length > 0 && selectedIndex < tasks.length) {
        setSelectedTask(tasks[selectedIndex]);
        setView("detail");
        return true;
      }
      return false;
    },
    [selectedIndex]
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

    // Start 5-second timeout for graceful shutdown
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
    }, 5000);
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
  const handleStopKey = useCallback(
    (tasks: Task[]): boolean => {
      if (activeColumn !== "in_progress") {
        return false;
      }
      if (tasks.length > 0 && selectedIndex < tasks.length) {
        const task = tasks[selectedIndex];
        if (task.status === "in_progress") {
          initiateStop(task);
          return true;
        }
      }
      return false;
    },
    [activeColumn, selectedIndex, initiateStop]
  );

  // Handle single-character mode/action keys
  const handleSingleCharKey = useCallback(
    (input: string, tasks: Task[]): boolean => {
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
        case "s":
        case "x":
          return handleStopKey(tasks);
        default:
          return false;
      }
    },
    [jumpToLast, handleSearchMatchNav, handleStopKey]
  );

  // Handle column navigation
  const handleColumnNav = useCallback(
    (input: string, isLeftArrow?: boolean, isRightArrow?: boolean): boolean => {
      if (isLeftArrow || input === "h") {
        navigateColumn(-1);
        return true;
      }
      if (isRightArrow || input === "l") {
        navigateColumn(1);
        return true;
      }
      return false;
    },
    [navigateColumn]
  );

  // Handle movement/action keys (arrows, hjkl, Enter, o)
  const handleMovementKeys = useCallback(
    (
      input: string,
      key: {
        isLeftArrow?: boolean;
        isRightArrow?: boolean;
        isUpArrow?: boolean;
        isDownArrow?: boolean;
        isReturn?: boolean;
      },
      tasks: Task[]
    ): boolean => {
      // Column navigation
      if (handleColumnNav(input, key.isLeftArrow, key.isRightArrow)) {
        return true;
      }

      // Vertical navigation
      if (key.isUpArrow || input === "k") {
        return handleVerticalNav("up", tasks);
      }
      if (key.isDownArrow || input === "j") {
        return handleVerticalNav("down", tasks);
      }

      // Open task
      if (key.isReturn || input === "o") {
        return handleOpenTask(tasks);
      }

      return false;
    },
    [handleColumnNav, handleVerticalNav, handleOpenTask]
  );

  // Handle kanban view navigation in normal mode
  const handleNormalModeInput = useCallback(
    (
      input: string,
      key: {
        isLeftArrow?: boolean;
        isRightArrow?: boolean;
        isUpArrow?: boolean;
        isDownArrow?: boolean;
        isReturn?: boolean;
        ctrl?: boolean;
        isEscape?: boolean;
      }
    ) => {
      const tasks = getTasksForColumn(activeColumn);

      // Check for gg (double-tap g)
      if (input === "g") {
        handleDoubleTapG();
        return;
      }

      // Clear last key on any other input
      lastKeyRef.current = { key: "", time: 0 };

      // Single-character mode/action keys (now passes tasks for stop action)
      if (handleSingleCharKey(input, tasks)) {
        return;
      }

      // Ctrl+C to quit
      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      // Movement/action keys
      if (handleMovementKeys(input, key, tasks)) {
        return;
      }

      // Quit (only if no search matches)
      if (input === "q" && searchMatches.length === 0) {
        exit();
      }
    },
    [
      exit,
      getTasksForColumn,
      activeColumn,
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

  // Handle kanban view navigation (routes to mode-specific handlers)
  const handleKanbanInput = useCallback(
    (
      input: string,
      key: {
        isLeftArrow?: boolean;
        isRightArrow?: boolean;
        isUpArrow?: boolean;
        isDownArrow?: boolean;
        isReturn?: boolean;
        ctrl?: boolean;
        isEscape?: boolean;
        isBackspace?: boolean;
        isDelete?: boolean;
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

  // Calculate content line counts for scroll bounds
  const getSpecLineCount = useCallback((): number => {
    return specContent.split("\n").length;
  }, [specContent]);

  const getLogsLineCount = useCallback((): number => {
    return logContent.split("\n").length;
  }, [logContent]);

  // Calculate viewport height for panels (terminal height minus chrome)
  const getPanelViewportHeight = useCallback((): number => {
    // Account for header, borders, padding
    return Math.max(1, terminalHeight - 7);
  }, [terminalHeight]);

  // Scroll the focused panel by a given amount
  const scrollFocusedPanel = useCallback(
    (delta: number) => {
      const viewportHeight = getPanelViewportHeight();
      if (focusedPanel === "spec") {
        const maxOffset = Math.max(0, getSpecLineCount() - viewportHeight);
        setSpecScrollOffset((prev) =>
          Math.min(maxOffset, Math.max(0, prev + delta))
        );
      } else {
        // When manually scrolling logs, disable auto-follow
        if (delta < 0) {
          setAutoFollow(false);
        }
        const maxOffset = Math.max(0, getLogsLineCount() - viewportHeight);
        setLogsScrollOffset((prev) =>
          Math.min(maxOffset, Math.max(0, prev + delta))
        );
      }
    },
    [focusedPanel, getSpecLineCount, getLogsLineCount, getPanelViewportHeight]
  );

  // Jump to top of focused panel
  const scrollToTop = useCallback(() => {
    if (focusedPanel === "spec") {
      setSpecScrollOffset(0);
    } else {
      setAutoFollow(false);
      setLogsScrollOffset(0);
    }
  }, [focusedPanel]);

  // Jump to bottom of focused panel
  const scrollToBottom = useCallback(() => {
    const viewportHeight = getPanelViewportHeight();
    if (focusedPanel === "spec") {
      const maxOffset = Math.max(0, getSpecLineCount() - viewportHeight);
      setSpecScrollOffset(maxOffset);
    } else {
      // Jumping to bottom re-enables auto-follow
      setAutoFollow(true);
      const maxOffset = Math.max(0, getLogsLineCount() - viewportHeight);
      setLogsScrollOffset(maxOffset);
    }
  }, [
    focusedPanel,
    getSpecLineCount,
    getLogsLineCount,
    getPanelViewportHeight,
  ]);

  // Toggle auto-follow for logs panel
  const toggleAutoFollow = useCallback(() => {
    setAutoFollow((prev) => !prev);
  }, []);

  // Switch focus between panels
  const togglePanelFocus = useCallback(() => {
    // Only toggle if we're in split view (not backlog)
    if (selectedTask && selectedTask.status !== "backlog") {
      setFocusedPanel((prev) => (prev === "spec" ? "logs" : "spec"));
    }
  }, [selectedTask]);

  // Reset scroll state when exiting detail view
  const exitDetailView = useCallback(() => {
    setView("kanban");
    setSelectedTask(null);
    setSpecContent("");
    setLogContent("");
    setFocusedPanel("spec");
    setSpecScrollOffset(0);
    setLogsScrollOffset(0);
    setAutoFollow(true);
  }, []);

  // Handle detail view scroll keys
  const handleDetailScrollKeys = useCallback(
    (
      input: string,
      key: {
        isUpArrow?: boolean;
        isDownArrow?: boolean;
        ctrl?: boolean;
      }
    ): boolean => {
      // Ctrl+U - half page up
      if (key.ctrl && input === "u") {
        const halfPage = Math.floor(getPanelViewportHeight() / 2);
        scrollFocusedPanel(-halfPage);
        return true;
      }

      // Ctrl+D - half page down
      if (key.ctrl && input === "d") {
        const halfPage = Math.floor(getPanelViewportHeight() / 2);
        scrollFocusedPanel(halfPage);
        return true;
      }

      // j or down arrow - scroll down one line
      if (key.isDownArrow || input === "j") {
        scrollFocusedPanel(1);
        return true;
      }

      // k or up arrow - scroll up one line
      if (key.isUpArrow || input === "k") {
        scrollFocusedPanel(-1);
        return true;
      }

      return false;
    },
    [scrollFocusedPanel, getPanelViewportHeight]
  );

  // Handle gg double-tap for detail view
  const handleDetailDoubleTapG = useCallback((): boolean => {
    const now = Date.now();
    const lastKey = lastKeyRef.current;
    if (lastKey.key === "g" && now - lastKey.time < DOUBLE_TAP_TIMEOUT) {
      scrollToTop();
      lastKeyRef.current = { key: "", time: 0 };
      return true;
    }
    lastKeyRef.current = { key: "g", time: now };
    return false;
  }, [scrollToTop]);

  // Handle detail view navigation
  const handleDetailInput = useCallback(
    (
      input: string,
      key: {
        isEscape?: boolean;
        isTab?: boolean;
        isUpArrow?: boolean;
        isDownArrow?: boolean;
        ctrl?: boolean;
      }
    ) => {
      // Escape or q to exit detail view
      if (key.isEscape || input === "q") {
        exitDetailView();
        return;
      }

      // Tab to switch panel focus
      if (key.isTab) {
        togglePanelFocus();
        return;
      }

      // f to toggle auto-follow
      if (input === "f") {
        toggleAutoFollow();
        return;
      }

      // G to jump to bottom
      if (input === "G") {
        scrollToBottom();
        return;
      }

      // g for gg detection
      if (input === "g") {
        handleDetailDoubleTapG();
        return;
      }

      // Handle scroll keys (j/k, arrows, ctrl+u/d)
      if (handleDetailScrollKeys(input, key)) {
        return;
      }
    },
    [
      exitDetailView,
      togglePanelFocus,
      toggleAutoFollow,
      scrollToBottom,
      handleDetailDoubleTapG,
      handleDetailScrollKeys,
    ]
  );

  // Keyboard input handling
  useKeyboard((keyEvent) => {
    // Map OpenTUI key event to our handler format
    const key = {
      isLeftArrow: keyEvent.name === "left",
      isRightArrow: keyEvent.name === "right",
      isUpArrow: keyEvent.name === "up",
      isDownArrow: keyEvent.name === "down",
      isReturn: keyEvent.name === "return",
      isEscape: keyEvent.name === "escape",
      isBackspace: keyEvent.name === "backspace",
      isDelete: keyEvent.name === "delete",
      isTab: keyEvent.name === "tab",
      ctrl: keyEvent.ctrl,
    };

    // Get the character input
    const input = keyEvent.sequence || "";

    if (view === "kanban") {
      handleKanbanInput(input, key);
    } else if (view === "detail") {
      handleDetailInput(input, key);
    }
  });

  // Loading state
  if (loading) {
    return (
      <box flexDirection="column" padding={1}>
        <text fg="#00FFFF">
          <LoadingSpinner /> Loading Ralph Wiggum CLI...
        </text>
      </box>
    );
  }

  // Error state
  if (error) {
    return (
      <box flexDirection="column" padding={1}>
        <text fg="#FF0000">Error: {error}</text>
        <text fg="#808080">Press q to quit.</text>
      </box>
    );
  }

  // Detail view
  if (view === "detail" && selectedTask) {
    return (
      <box flexDirection="column" height={terminalHeight} width="100%">
        <box marginBottom={1} paddingLeft={1} paddingRight={1}>
          <text fg="#00FFFF">
            <strong>🧑‍🚀 Ralph Wiggum CLI</strong>
          </text>
        </box>
        <box flexGrow={1} paddingLeft={1} paddingRight={1}>
          <DetailView
            autoFollow={autoFollow}
            focusedPanel={focusedPanel}
            height={terminalHeight - 4}
            isStreaming={selectedTask.status === "in_progress"}
            logContent={logContent}
            logsScrollOffset={logsScrollOffset}
            specContent={specContent}
            specScrollOffset={specScrollOffset}
            task={selectedTask}
            terminalWidth={terminalWidth}
          />
        </box>
      </box>
    );
  }

  // Main Kanban view
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
          <span fg="#FFFF00">/</span>
          <span fg="#FFFFFF">{searchQuery}</span>
          <span fg="#808080">_</span>
          {searchMatches.length > 0 && (
            <span fg="#808080">
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
          <span fg="#FFFF00">{commandBuffer}</span>
          <span fg="#808080">_</span>
        </text>
      );
    }
    // Show stop hint when in In Progress column
    if (activeColumn === "in_progress" && plan.inProgress.length > 0) {
      return (
        <text fg="#808080">
          [hjkl] move [o] open [s] stop [/] search [?] help [:q] quit
        </text>
      );
    }
    return (
      <text fg="#808080">
        [hjkl] move [o] open [/] search [?] help [:q] quit
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
        <text fg="#00FFFF">
          <strong>🧑‍🚀 Ralph Wiggum CLI</strong>
        </text>
        {getStatusBarContent()}
      </box>

      {/* Kanban Board */}
      <box flexGrow={1} paddingLeft={1} paddingRight={1}>
        {totalTasks === 0 ? (
          <box flexDirection="column" paddingBottom={2} paddingTop={2}>
            <text fg="#FFFF00">No specs found in IMPLEMENTATION_PLAN.md</text>
            <text fg="#808080">
              Run `ralph-wiggum-cli start plan` to generate the implementation
              plan.
            </text>
          </box>
        ) : (
          <Kanban
            activeColumn={activeColumn}
            backlog={plan.backlog}
            completed={plan.completed}
            inProgress={plan.inProgress}
            selectedIndex={selectedIndex}
            stopped={plan.stopped}
            stoppingTaskId={stoppingTaskId}
            terminalWidth={terminalWidth}
          />
        )}
      </box>

      {/* Footer */}
      <box marginTop={1} paddingLeft={1} paddingRight={1}>
        <text fg="#808080">
          {totalTasks} spec(s) | {plan.completed.length} completed
        </text>
      </box>
    </box>
  );
}
