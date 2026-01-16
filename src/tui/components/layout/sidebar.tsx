import { TextAttributes } from "@opentui/core";
import type React from "react";
import { LoadingSpinner } from "../../components/primitives/loading-spinner";
import { STATUS_COLORS, STATUS_ICONS, TOKYO_NIGHT } from "../../lib/constants";
import type { Task } from "../../types";

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
  const icon = STATUS_ICONS[task.status] ?? "?";
  const color = isSelected
    ? TOKYO_NIGHT.blue
    : (STATUS_COLORS[task.status] ?? TOKYO_NIGHT.comment);

  if (isStopping) {
    let attrs = TextAttributes.BOLD;
    if (isSelected) {
      // biome-ignore lint/suspicious/noBitwiseOperators: intentional bitwise OR
      attrs = TextAttributes.BOLD | TextAttributes.INVERSE;
    }
    return (
      <text attributes={attrs} fg={TOKYO_NIGHT.yellow}>
        {" "}
        <LoadingSpinner /> {task.name.slice(0, 20)}...
      </text>
    );
  }

  const displayName =
    task.name.length > 22 ? `${task.name.slice(0, 22)}...` : task.name;
  const content = ` ${icon} ${displayName}`;

  if (isSelected) {
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional bitwise OR
    const attrs = TextAttributes.BOLD | TextAttributes.INVERSE;
    return (
      <text attributes={attrs} fg={color}>
        {content}
      </text>
    );
  }

  return <text fg={color}>{content}</text>;
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
        <span fg={TOKYO_NIGHT.comment}> ({tasks.length})</span>
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
        <text fg={TOKYO_NIGHT.comment}> Press 'c' to show</text>
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
      borderColor={TOKYO_NIGHT.border}
      borderStyle="single"
      flexDirection="column"
      height={height}
      paddingLeft={1}
      paddingRight={1}
      width={width}
    >
      <Section
        headerColor={TOKYO_NIGHT.yellow}
        icon="▶"
        selectedTaskId={selectedTaskId}
        stoppingTaskId={stoppingTaskId}
        tasks={inProgress}
        title="IN PROGRESS"
      />
      <Section
        headerColor={TOKYO_NIGHT.fg}
        icon="○"
        selectedTaskId={selectedTaskId}
        stoppingTaskId={stoppingTaskId}
        tasks={backlogWithStopped}
        title="BACKLOG"
      />
      <Section
        collapsed={!showCompleted}
        headerColor={TOKYO_NIGHT.green}
        icon="✓"
        selectedTaskId={selectedTaskId}
        tasks={completed}
        title="COMPLETED"
      />
    </box>
  );
}
