import {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/layout/sidebar";
import { ConfirmDialog } from "./components/overlays/confirm-dialog";
import { HelpOverlay } from "./components/overlays/help-overlay";
import { LoadingSpinner } from "./components/primitives/loading-spinner";
import { TaskDetail } from "./components/viewers/task-detail";
import {
  type KeyEvent,
  useKeyboardNavigation,
} from "./hooks/use-keyboard-navigation";
import { useSessionPolling } from "./hooks/use-session-polling";
import { useTaskManager } from "./hooks/use-task-manager";
import { TOKYO_NIGHT } from "./lib/constants";
import {
  getLatestSessionLog,
  parseImplementationPlan,
  readSpecContent,
} from "./lib/file-operations";
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

  // Session polling hook
  const { runningSession, setRunningSession } = useSessionPolling(projectPath);

  // Reload plan callback (for when task is stopped)
  const reloadPlan = useCallback(async (): Promise<void> => {
    const parsedPlan = await parseImplementationPlan(projectPath);
    setPlan(parsedPlan);
  }, [projectPath]);

  // Task manager hook
  const taskManager = useTaskManager({
    projectPath,
    runningSession,
    logPath,
    onTaskStopped: reloadPlan,
    onSessionUpdate: setRunningSession,
  });

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

  // Handle stop keybindings (s or x)
  const handleStopKey = useCallback((): boolean => {
    if (selectedTask?.status === "in_progress") {
      taskManager.initiateStop(selectedTask);
      return true;
    }
    return false;
  }, [selectedTask, taskManager]);

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
      if (taskManager.confirmState !== "force-kill") {
        return false;
      }
      if (input === "y" || input === "Y") {
        taskManager.forceKill();
      } else if (input === "n" || input === "N" || isEscapeKey) {
        taskManager.cancelStop();
      }
      return true;
    },
    [taskManager]
  );

  // Handle stop confirmation dialog input
  const handleStopDialogInput = useCallback(
    (input: string, isEscapeKey: boolean): boolean => {
      if (taskManager.confirmState !== "confirm-stop") {
        return false;
      }
      if (input === "y" || input === "Y") {
        taskManager.confirmStop();
      } else if (input === "n" || input === "N" || isEscapeKey) {
        taskManager.cancelStop();
      }
      return true;
    },
    [taskManager]
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
  if (taskManager.confirmState === "confirm-stop" && taskManager.taskToStop) {
    return (
      <box
        alignItems="center"
        flexDirection="column"
        height={terminalHeight}
        justifyContent="center"
        width="100%"
      >
        <ConfirmDialog
          taskName={taskManager.taskToStop.name}
          type="confirm-stop"
          visible={true}
        />
      </box>
    );
  }

  // Show force kill confirmation dialog
  if (taskManager.confirmState === "force-kill" && taskManager.taskToStop) {
    return (
      <box
        alignItems="center"
        flexDirection="column"
        height={terminalHeight}
        justifyContent="center"
        width="100%"
      >
        <ConfirmDialog
          taskName={taskManager.taskToStop.name}
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
              stoppingTaskId={taskManager.stoppingTaskId}
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
