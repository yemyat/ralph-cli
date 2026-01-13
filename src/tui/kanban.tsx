import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { Card } from "./card.js";
import type { Task, TaskStatus } from "./utils.js";

interface ColumnProps {
  title: string;
  tasks: Task[];
  selectedIndex: number;
  isActiveColumn: boolean;
  columnWidth: number;
  stoppingTaskId?: string | null;
}

function Column({
  title,
  tasks,
  selectedIndex,
  isActiveColumn,
  columnWidth,
  stoppingTaskId,
}: ColumnProps): React.ReactElement {
  const headerColor = isActiveColumn ? "cyan" : "white";

  const renderTask = (task: Task, index: number): React.ReactElement => {
    const isStopping = task.id === stoppingTaskId;
    const isSelected = isActiveColumn && index === selectedIndex;

    if (isStopping) {
      return (
        <Box key={task.id}>
          <Text bold color="yellow" inverse={isSelected}>
            {" "}
            <Spinner type="dots" /> {task.name} (Stopping...){" "}
          </Text>
        </Box>
      );
    }

    return (
      <Card
        isSelected={isSelected}
        key={task.id}
        name={task.name}
        status={task.status}
      />
    );
  };

  return (
    <Box
      borderColor={isActiveColumn ? "cyan" : "gray"}
      borderStyle="single"
      flexDirection="column"
      paddingX={1}
      width={columnWidth}
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color={headerColor}>
          {title}
        </Text>
      </Box>
      {tasks.length === 0 ? (
        <Text color="gray" dimColor>
          (empty)
        </Text>
      ) : (
        tasks.map((task, index) => renderTask(task, index))
      )}
    </Box>
  );
}

interface KanbanProps {
  inProgress: Task[];
  backlog: Task[];
  completed: Task[];
  stopped: Task[];
  activeColumn: TaskStatus;
  selectedIndex: number;
  stoppingTaskId?: string | null;
}

export function Kanban({
  inProgress,
  backlog,
  completed,
  stopped,
  activeColumn,
  selectedIndex,
  stoppingTaskId,
}: KanbanProps): React.ReactElement {
  // Calculate column widths based on terminal size
  const columnWidth = Math.floor(process.stdout.columns / 3) - 2;

  // Combine backlog and stopped tasks for display in backlog column
  // Stopped tasks appear first with their special icon
  const backlogWithStopped = [...stopped, ...backlog];

  return (
    <Box flexDirection="row" width="100%">
      <Column
        columnWidth={columnWidth}
        isActiveColumn={
          activeColumn === "backlog" || activeColumn === "stopped"
        }
        selectedIndex={
          activeColumn === "backlog" || activeColumn === "stopped"
            ? selectedIndex
            : -1
        }
        stoppingTaskId={stoppingTaskId}
        tasks={backlogWithStopped}
        title="BACKLOG"
      />
      <Column
        columnWidth={columnWidth}
        isActiveColumn={activeColumn === "in_progress"}
        selectedIndex={activeColumn === "in_progress" ? selectedIndex : -1}
        stoppingTaskId={stoppingTaskId}
        tasks={inProgress}
        title="IN PROGRESS"
      />
      <Column
        columnWidth={columnWidth}
        isActiveColumn={activeColumn === "completed"}
        selectedIndex={activeColumn === "completed" ? selectedIndex : -1}
        stoppingTaskId={stoppingTaskId}
        tasks={completed}
        title="COMPLETED"
      />
    </Box>
  );
}
