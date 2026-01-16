import { TextAttributes } from "@opentui/core";
import type React from "react";
import { Card } from "./card";
import { LoadingSpinner } from "./loading-spinner";
import type { Task, TaskStatus } from "./utils";

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
}: ColumnProps): React.ReactNode {
  const headerColor = isActiveColumn ? "#00FFFF" : "#FFFFFF";
  const borderColor = isActiveColumn ? "#00FFFF" : "#808080";

  const renderTask = (task: Task, index: number): React.ReactNode => {
    const isStopping = task.id === stoppingTaskId;
    const isSelected = isActiveColumn && index === selectedIndex;

    if (isStopping) {
      // Compute attributes for stopping task
      let attrs = TextAttributes.BOLD;
      if (isSelected) {
        // biome-ignore lint/suspicious/noBitwiseOperators: intentional bitwise OR for TextAttributes
        attrs = TextAttributes.BOLD | TextAttributes.INVERSE;
      }
      return (
        <box key={task.id}>
          <text attributes={attrs} fg="#FFFF00">
            {" "}
            <LoadingSpinner /> {task.name} (Stopping...){" "}
          </text>
        </box>
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
    <box
      border
      borderColor={borderColor}
      borderStyle="single"
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      width={columnWidth}
    >
      <box justifyContent="center" marginBottom={1}>
        <text fg={headerColor}>
          <strong>{title}</strong>
        </text>
      </box>
      {tasks.length === 0 ? (
        <text fg="#808080">(empty)</text>
      ) : (
        tasks.map((task, index) => renderTask(task, index))
      )}
    </box>
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
  terminalWidth: number;
}

export function Kanban({
  inProgress,
  backlog,
  completed,
  stopped,
  activeColumn,
  selectedIndex,
  stoppingTaskId,
  terminalWidth,
}: KanbanProps): React.ReactNode {
  // Calculate column widths based on terminal size
  const columnWidth = Math.floor(terminalWidth / 3) - 2;

  // Combine backlog and stopped tasks for display in backlog column
  // Stopped tasks appear first with their special icon
  const backlogWithStopped = [...stopped, ...backlog];

  return (
    <box flexDirection="row" width="100%">
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
    </box>
  );
}
