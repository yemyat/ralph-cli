import { Box, Text, useApp, useInput, useStdout } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DetailView, type FocusedPanel } from "./detail-view.js";
import { HelpOverlay } from "./help-overlay.js";
import { Kanban } from "./kanban.js";
import {
  getLatestSessionLog,
  type ParsedPlan,
  parseImplementationPlan,
  readLogContent,
  readSpecContent,
  type Task,
  type TaskStatus,
} from "./utils.js";

type View = "kanban" | "detail";
type Mode = "normal" | "search" | "command";

interface AppProps {
  projectPath: string;
}

// Timeout for detecting double-tap (gg)
const DOUBLE_TAP_TIMEOUT = 300;

const COLUMN_ORDER: TaskStatus[] = ["backlog", "in_progress", "completed"];

export function App({ projectPath }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ParsedPlan>({
    inProgress: [],
    backlog: [],
    completed: [],
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

  // Get tasks for current column
  const getTasksForColumn = useCallback(
    (column: TaskStatus): Task[] => {
      switch (column) {
        case "backlog":
          return plan.backlog;
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
    return [...plan.backlog, ...plan.inProgress, ...plan.completed];
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
        default:
          return false;
      }
    },
    [jumpToLast, handleSearchMatchNav]
  );

  // Handle column navigation
  const handleColumnNav = useCallback(
    (input: string, leftArrow?: boolean, rightArrow?: boolean): boolean => {
      if (leftArrow || input === "h") {
        navigateColumn(-1);
        return true;
      }
      if (rightArrow || input === "l") {
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
        leftArrow?: boolean;
        rightArrow?: boolean;
        upArrow?: boolean;
        downArrow?: boolean;
        return?: boolean;
      },
      tasks: Task[]
    ): boolean => {
      // Column navigation
      if (handleColumnNav(input, key.leftArrow, key.rightArrow)) {
        return true;
      }

      // Vertical navigation
      if (key.upArrow || input === "k") {
        return handleVerticalNav("up", tasks);
      }
      if (key.downArrow || input === "j") {
        return handleVerticalNav("down", tasks);
      }

      // Open task
      if (key.return || input === "o") {
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
        leftArrow?: boolean;
        rightArrow?: boolean;
        upArrow?: boolean;
        downArrow?: boolean;
        return?: boolean;
        ctrl?: boolean;
        escape?: boolean;
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

      // Single-character mode/action keys
      if (handleSingleCharKey(input)) {
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
        return?: boolean;
        escape?: boolean;
        backspace?: boolean;
        delete?: boolean;
      }
    ) => {
      // Cancel search
      if (key.escape) {
        setMode("normal");
        setSearchQuery("");
        return;
      }

      // Select current match
      if (key.return) {
        selectSearchMatch();
        return;
      }

      // Backspace
      if (key.backspace || key.delete) {
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
        return?: boolean;
        escape?: boolean;
        backspace?: boolean;
        delete?: boolean;
      }
    ) => {
      // Cancel command
      if (key.escape) {
        setMode("normal");
        setCommandBuffer("");
        return;
      }

      // Execute command
      if (key.return) {
        if (commandBuffer === ":q" || commandBuffer === ":quit") {
          exit();
        }
        setMode("normal");
        setCommandBuffer("");
        return;
      }

      // Backspace
      if (key.backspace || key.delete) {
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

  // Handle kanban view navigation (routes to mode-specific handlers)
  const handleKanbanInput = useCallback(
    (
      input: string,
      key: {
        leftArrow?: boolean;
        rightArrow?: boolean;
        upArrow?: boolean;
        downArrow?: boolean;
        return?: boolean;
        ctrl?: boolean;
        escape?: boolean;
        backspace?: boolean;
        delete?: boolean;
      }
    ) => {
      // Close help overlay
      if (showHelp) {
        if (key.escape || input === "?" || input === "q") {
          setShowHelp(false);
        }
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
      showHelp,
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
    const termHeight = stdout?.rows || 24;
    // Account for header, borders, padding
    return Math.max(1, termHeight - 7);
  }, [stdout]);

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
        upArrow?: boolean;
        downArrow?: boolean;
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
      if (key.downArrow || input === "j") {
        scrollFocusedPanel(1);
        return true;
      }

      // k or up arrow - scroll up one line
      if (key.upArrow || input === "k") {
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
        escape?: boolean;
        tab?: boolean;
        upArrow?: boolean;
        downArrow?: boolean;
        ctrl?: boolean;
      }
    ) => {
      // Escape or q to exit detail view
      if (key.escape || input === "q") {
        exitDetailView();
        return;
      }

      // Tab to switch panel focus
      if (key.tab) {
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
  useInput((input, key) => {
    if (view === "kanban") {
      handleKanbanInput(input, key);
    } else if (view === "detail") {
      handleDetailInput(input, key);
    }
  });

  // Calculate available height
  const terminalHeight = stdout?.rows || 24;

  // Loading state
  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">
          <Spinner type="dots" /> Loading Ralph Wiggum CLI...
        </Text>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text color="gray">Press q to quit.</Text>
      </Box>
    );
  }

  // Detail view
  if (view === "detail" && selectedTask) {
    return (
      <Box flexDirection="column" height={terminalHeight} width="100%">
        <Box marginBottom={1} paddingX={1}>
          <Text bold color="cyan">
            🧑‍🚀 Ralph Wiggum CLI
          </Text>
        </Box>
        <Box flexGrow={1} paddingX={1}>
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
          />
        </Box>
      </Box>
    );
  }

  // Main Kanban view
  const totalTasks =
    plan.backlog.length + plan.inProgress.length + plan.completed.length;

  // Build status bar text based on mode
  const getStatusBarText = (): React.ReactElement => {
    if (mode === "search") {
      return (
        <Text>
          <Text color="yellow">/</Text>
          <Text color="white">{searchQuery}</Text>
          <Text color="gray">_</Text>
          {searchMatches.length > 0 && (
            <Text color="gray">
              {" "}
              ({searchMatchIndex + 1}/{searchMatches.length})
            </Text>
          )}
        </Text>
      );
    }
    if (mode === "command") {
      return (
        <Text>
          <Text color="yellow">{commandBuffer}</Text>
          <Text color="gray">_</Text>
        </Text>
      );
    }
    return (
      <Text color="gray">
        [hjkl] move [o] open [/] search [?] help [:q] quit
      </Text>
    );
  };

  // Show help overlay
  if (showHelp) {
    return (
      <Box flexDirection="column" height={terminalHeight} width="100%">
        <HelpOverlay height={terminalHeight} width={stdout?.columns || 80} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={terminalHeight} width="100%">
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1} paddingX={1}>
        <Text bold color="cyan">
          🧑‍🚀 Ralph Wiggum CLI
        </Text>
        {getStatusBarText()}
      </Box>

      {/* Kanban Board */}
      <Box flexGrow={1} paddingX={1}>
        {totalTasks === 0 ? (
          <Box flexDirection="column" paddingY={2}>
            <Text color="yellow">No specs found in IMPLEMENTATION_PLAN.md</Text>
            <Text color="gray">
              Run `ralph-wiggum-cli start plan` to generate the implementation
              plan.
            </Text>
          </Box>
        ) : (
          <Kanban
            activeColumn={activeColumn}
            backlog={plan.backlog}
            completed={plan.completed}
            inProgress={plan.inProgress}
            selectedIndex={selectedIndex}
          />
        )}
      </Box>

      {/* Footer */}
      <Box marginTop={1} paddingX={1}>
        <Text color="gray" dimColor>
          {totalTasks} spec(s) | {plan.completed.length} completed
        </Text>
      </Box>
    </Box>
  );
}
