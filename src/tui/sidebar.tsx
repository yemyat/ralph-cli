import { TextAttributes } from "@opentui/core";
import type React from "react";
import { LoadingSpinner } from "./loading-spinner";
import type { Task } from "./utils";

interface SidebarItemProps {
  task: Task;
  isSelected: boolean;
  isStopping?: boolean;
}

function SidebarItem({
  task,
  isSelected,
  isStopping,
}: SidebarItemProps): React.ReactNode {
  const getIcon = (): string => {
    switch (task.status) {
      case "in_progress":
        return "●";
      case "backlog":
        return "○";
      case "completed":
        return "✓";
      case "stopped":
        return "■";
      default:
        return "?";
    }
  };

  const getColor = (): string => {
    if (isSelected) {
      return "#7aa2f7"; // tokyo night blue
    }
    switch (task.status) {
      case "in_progress":
        return "#e0af68"; // tokyo night yellow
      case "backlog":
        return "#c0caf5"; // tokyo night fg
      case "completed":
        return "#9ece6a"; // tokyo night green
      case "stopped":
        return "#f7768e"; // tokyo night red
      default:
        return "#565f89"; // tokyo night comment
    }
  };

  if (isStopping) {
    let attrs = TextAttributes.BOLD;
    if (isSelected) {
      // biome-ignore lint/suspicious/noBitwiseOperators: intentional bitwise OR
      attrs = TextAttributes.BOLD | TextAttributes.INVERSE;
    }
    return (
      <text attributes={attrs} fg="#e0af68">
        {" "}
        <LoadingSpinner /> {task.name.slice(0, 20)}...
      </text>
    );
  }

  const displayName =
    task.name.length > 22 ? `${task.name.slice(0, 22)}...` : task.name;
  const content = ` ${getIcon()} ${displayName}`;

  if (isSelected) {
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional bitwise OR
    const attrs = TextAttributes.BOLD | TextAttributes.INVERSE;
    return (
      <text attributes={attrs} fg={getColor()}>
        {content}
      </text>
    );
  }

  return <text fg={getColor()}>{content}</text>;
}

interface SectionProps {
  title: string;
  tasks: Task[];
  selectedTaskId: string | null;
  stoppingTaskId?: string | null;
  collapsed?: boolean;
  icon: string;
  headerColor: string;
}

function Section({
  title,
  tasks,
  selectedTaskId,
  stoppingTaskId,
  collapsed,
  icon,
  headerColor,
}: SectionProps): React.ReactNode {
  if (collapsed && tasks.length === 0) {
    return null;
  }

  return (
    <box flexDirection="column" marginBottom={1}>
      <text fg={headerColor}>
        <strong>
          {icon} {title}
        </strong>
        <span fg="#565f89"> ({tasks.length})</span>
      </text>
      {!collapsed &&
        tasks.map((task) => (
          <SidebarItem
            isSelected={task.id === selectedTaskId}
            isStopping={task.id === stoppingTaskId}
            key={task.id}
            task={task}
          />
        ))}
      {collapsed && tasks.length > 0 && (
        <text fg="#565f89"> Press 'c' to show</text>
      )}
    </box>
  );
}

interface SidebarProps {
  inProgress: Task[];
  backlog: Task[];
  stopped: Task[];
  completed: Task[];
  selectedTaskId: string | null;
  stoppingTaskId?: string | null;
  showCompleted: boolean;
  width: number;
  height: number;
}

export function Sidebar({
  inProgress,
  backlog,
  stopped,
  completed,
  selectedTaskId,
  stoppingTaskId,
  showCompleted,
  width,
  height,
}: SidebarProps): React.ReactNode {
  const backlogWithStopped = [...stopped, ...backlog];

  return (
    <box
      border
      borderColor="#414868"
      borderStyle="single"
      flexDirection="column"
      height={height}
      paddingLeft={1}
      paddingRight={1}
      width={width}
    >
      <Section
        headerColor="#e0af68"
        icon="▶"
        selectedTaskId={selectedTaskId}
        stoppingTaskId={stoppingTaskId}
        tasks={inProgress}
        title="IN PROGRESS"
      />
      <Section
        headerColor="#c0caf5"
        icon="○"
        selectedTaskId={selectedTaskId}
        stoppingTaskId={stoppingTaskId}
        tasks={backlogWithStopped}
        title="BACKLOG"
      />
      <Section
        collapsed={!showCompleted}
        headerColor="#9ece6a"
        icon="✓"
        selectedTaskId={selectedTaskId}
        tasks={completed}
        title="COMPLETED"
      />
    </box>
  );
}
