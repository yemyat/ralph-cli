import type React from "react";
import type { Task, TaskStatus } from "./utils";

interface ParsedSpec {
  title: string;
  overview: string[];
  tasks: string[];
  acceptanceCriteria: string[];
}

const NUMBERED_LIST_REGEX = /^\d+\.\s/;

function getStatusIcon(status: TaskStatus): string {
  switch (status) {
    case "in_progress":
      return "●";
    case "completed":
      return "✓";
    case "stopped":
      return "■";
    default:
      return "○";
  }
}

function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case "in_progress":
      return "#e0af68"; // tokyo night yellow
    case "completed":
      return "#9ece6a"; // tokyo night green
    case "stopped":
      return "#f7768e"; // tokyo night red
    default:
      return "#c0caf5"; // tokyo night fg
  }
}

function parseSpecContent(content: string): ParsedSpec {
  const lines = content.split("\n");
  const result: ParsedSpec = {
    title: "",
    overview: [],
    tasks: [],
    acceptanceCriteria: [],
  };

  let currentSection: "none" | "overview" | "tasks" | "criteria" = "none";

  for (const line of lines) {
    const trimmed = line.trim();
    const lowerTrimmed = trimmed.toLowerCase();

    // Main title
    if (trimmed.startsWith("# ") && !result.title) {
      result.title = trimmed.slice(2);
      continue;
    }

    // Section detection
    if (
      lowerTrimmed.startsWith("## overview") ||
      lowerTrimmed.startsWith("## description") ||
      lowerTrimmed.startsWith("## summary")
    ) {
      currentSection = "overview";
      continue;
    }
    if (
      lowerTrimmed.startsWith("## task") ||
      lowerTrimmed.startsWith("## implementation")
    ) {
      currentSection = "tasks";
      continue;
    }
    if (
      lowerTrimmed.startsWith("## acceptance") ||
      lowerTrimmed.startsWith("## criteria") ||
      lowerTrimmed.startsWith("## done when") ||
      lowerTrimmed.startsWith("## definition of done")
    ) {
      currentSection = "criteria";
      continue;
    }
    // Any other H2 resets the section
    if (trimmed.startsWith("## ")) {
      currentSection = "none";
      continue;
    }

    // Skip empty lines and comments at section boundaries
    if (!trimmed || trimmed.startsWith("<!--")) {
      continue;
    }

    // Collect content based on section
    switch (currentSection) {
      case "overview":
        result.overview.push(line);
        break;
      case "tasks":
        result.tasks.push(line);
        break;
      case "criteria":
        result.acceptanceCriteria.push(line);
        break;
      default:
        break;
    }
  }

  return result;
}

function renderLine(line: string, index: number): React.ReactNode {
  const trimmed = line.trim();

  // Completed checkbox
  if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
    return (
      <text fg="#9ece6a" key={index}>
        {"  "}✓ {trimmed.slice(6)}
      </text>
    );
  }

  // Incomplete checkbox
  if (trimmed.startsWith("- [ ]")) {
    return (
      <text fg="#e0af68" key={index}>
        {"  "}○ {trimmed.slice(6)}
      </text>
    );
  }

  // Bullet point
  if (trimmed.startsWith("- ")) {
    return (
      <text fg="#c0caf5" key={index}>
        {"  "}• {trimmed.slice(2)}
      </text>
    );
  }

  // Numbered list
  if (NUMBERED_LIST_REGEX.test(trimmed)) {
    return (
      <text fg="#c0caf5" key={index}>
        {"  "}
        {trimmed}
      </text>
    );
  }

  // Regular text
  return (
    <text fg="#a9b1d6" key={index}>
      {line}
    </text>
  );
}

interface TaskDetailProps {
  task: Task | null;
  specContent: string;
  height: number;
  scrollOffset: number;
}

export function TaskDetail({
  task,
  specContent,
  height,
}: TaskDetailProps): React.ReactNode {
  if (!task) {
    return (
      <box
        alignItems="center"
        border
        borderColor="#414868"
        borderStyle="single"
        flexDirection="column"
        height={height}
        justifyContent="center"
        paddingLeft={2}
        paddingRight={2}
        width="100%"
      >
        <text fg="#565f89">Select a task to view details</text>
        <text fg="#565f89">Use j/k to navigate</text>
      </box>
    );
  }

  const parsed = parseSpecContent(specContent);
  const statusIcon = getStatusIcon(task.status);
  const statusColor = getStatusColor(task.status);

  // Collect all content lines for scrolling
  const contentLines: React.ReactNode[] = [];

  // Overview section
  if (parsed.overview.length > 0) {
    contentLines.push(
      <box flexDirection="column" key="overview" marginBottom={1}>
        <text fg="#7aa2f7">
          <strong>📋 Overview</strong>
        </text>
        {parsed.overview.map((line, i) => renderLine(line, i))}
      </box>
    );
  }

  // Tasks section
  if (parsed.tasks.length > 0) {
    contentLines.push(
      <box flexDirection="column" key="tasks" marginBottom={1}>
        <text fg="#bb9af7">
          <strong>📝 Tasks</strong>
        </text>
        {parsed.tasks.map((line, i) => renderLine(line, i))}
      </box>
    );
  }

  // Acceptance Criteria section
  if (parsed.acceptanceCriteria.length > 0) {
    contentLines.push(
      <box flexDirection="column" key="criteria" marginBottom={1}>
        <text fg="#9ece6a">
          <strong>✅ Acceptance Criteria</strong>
        </text>
        {parsed.acceptanceCriteria.map((line, i) => renderLine(line, i))}
      </box>
    );
  }

  // Show raw content if nothing parsed
  if (contentLines.length === 0 && specContent) {
    const rawLines = specContent.split("\n").slice(0, 50);
    contentLines.push(
      <box flexDirection="column" key="raw">
        {rawLines.map((line, i) => (
          <text key={`raw-${i}-${line.slice(0, 10)}`}>{line}</text>
        ))}
      </box>
    );
  }

  return (
    <box
      border
      borderColor="#414868"
      borderStyle="single"
      flexDirection="column"
      height={height}
      overflow="hidden"
      paddingLeft={2}
      paddingRight={2}
      width="100%"
    >
      {/* Title header */}
      <box marginBottom={1}>
        <text fg={statusColor}>
          <strong>
            {statusIcon} {parsed.title || task.name}
          </strong>
        </text>
      </box>

      {/* Spec path */}
      <text fg="#565f89">{task.specPath}</text>

      {/* Content */}
      <box flexDirection="column" marginTop={1}>
        {contentLines}
      </box>
    </box>
  );
}
