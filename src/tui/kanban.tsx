import { Box, Text } from "ink";
import type React from "react";
import { Card } from "./card.js";
import type { Task, TaskStatus } from "./utils.js";

interface ColumnProps {
  title: string;
  tasks: Task[];
  selectedIndex: number;
  isActiveColumn: boolean;
  columnWidth: number;
}

function Column({
  title,
  tasks,
  selectedIndex,
  isActiveColumn,
  columnWidth,
}: ColumnProps): React.ReactElement {
  const headerColor = isActiveColumn ? "cyan" : "white";

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
        tasks.map((task, index) => (
          <Card
            isSelected={isActiveColumn && index === selectedIndex}
            key={task.id}
            name={task.name}
            status={task.status}
          />
        ))
      )}
    </Box>
  );
}

interface KanbanProps {
  inProgress: Task[];
  backlog: Task[];
  completed: Task[];
  activeColumn: TaskStatus;
  selectedIndex: number;
}

export function Kanban({
  inProgress,
  backlog,
  completed,
  activeColumn,
  selectedIndex,
}: KanbanProps): React.ReactElement {
  // Calculate column widths based on terminal size
  const columnWidth = Math.floor(process.stdout.columns / 3) - 2;

  return (
    <Box flexDirection="row" width="100%">
      <Column
        columnWidth={columnWidth}
        isActiveColumn={activeColumn === "backlog"}
        selectedIndex={activeColumn === "backlog" ? selectedIndex : -1}
        tasks={backlog}
        title="BACKLOG"
      />
      <Column
        columnWidth={columnWidth}
        isActiveColumn={activeColumn === "in_progress"}
        selectedIndex={activeColumn === "in_progress" ? selectedIndex : -1}
        tasks={inProgress}
        title="IN PROGRESS"
      />
      <Column
        columnWidth={columnWidth}
        isActiveColumn={activeColumn === "completed"}
        selectedIndex={activeColumn === "completed" ? selectedIndex : -1}
        tasks={completed}
        title="COMPLETED"
      />
    </Box>
  );
}
