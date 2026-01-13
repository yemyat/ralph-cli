import { Box, Text, useApp, useInput, useStdout } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { DetailView } from "./detail-view.js";
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

interface AppProps {
  projectPath: string;
}

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

  // Handle kanban view navigation
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
      }
    ) => {
      // Quit on q or Ctrl+C
      const shouldQuit = input === "q" || (key.ctrl && input === "c");
      if (shouldQuit) {
        exit();
        return;
      }

      // Navigate columns
      if (key.leftArrow) {
        navigateColumn(-1);
        return;
      }
      if (key.rightArrow) {
        navigateColumn(1);
        return;
      }

      // Navigate items vertically
      if (key.upArrow && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
        return;
      }

      const tasks = getTasksForColumn(activeColumn);
      if (key.downArrow && selectedIndex < tasks.length - 1) {
        setSelectedIndex(selectedIndex + 1);
        return;
      }

      // Enter to drill into a task
      const canEnter =
        key.return && tasks.length > 0 && selectedIndex < tasks.length;
      if (canEnter) {
        setSelectedTask(tasks[selectedIndex]);
        setView("detail");
      }
    },
    [exit, navigateColumn, selectedIndex, getTasksForColumn, activeColumn]
  );

  // Handle detail view navigation
  const handleDetailInput = useCallback(
    (input: string, key: { escape?: boolean }) => {
      if (key.escape || input === "q") {
        setView("kanban");
        setSelectedTask(null);
        setSpecContent("");
        setLogContent("");
      }
    },
    []
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
            height={terminalHeight - 4}
            isStreaming={selectedTask.status === "in_progress"}
            logContent={logContent}
            specContent={specContent}
            task={selectedTask}
          />
        </Box>
      </Box>
    );
  }

  // Main Kanban view
  const totalTasks =
    plan.backlog.length + plan.inProgress.length + plan.completed.length;

  return (
    <Box flexDirection="column" height={terminalHeight} width="100%">
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1} paddingX={1}>
        <Text bold color="cyan">
          🧑‍🚀 Ralph Wiggum CLI
        </Text>
        <Text color="gray">[←→] columns [↑↓] select [Enter] open [q] quit</Text>
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
