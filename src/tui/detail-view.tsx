import { Box, Text } from "ink";
import type React from "react";
import { LogViewer } from "./log-viewer.js";
import { SpecViewer } from "./spec-viewer.js";
import type { Task } from "./utils.js";

interface DetailViewProps {
  task: Task;
  specContent: string;
  logContent: string;
  isStreaming: boolean;
  height: number;
}

export function DetailView({
  task,
  specContent,
  logContent,
  isStreaming,
  height,
}: DetailViewProps): React.ReactElement {
  // For backlog items, show spec only (full width)
  if (task.status === "backlog") {
    return (
      <Box flexDirection="column" width="100%">
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color="cyan">
            {task.name}
          </Text>
          <Text color="gray" dimColor>
            [Esc] back
          </Text>
        </Box>
        <SpecViewer content={specContent} height={height - 3} title="Spec" />
      </Box>
    );
  }

  // For in_progress and completed, show split view
  const panelHeight = height - 3;
  const panelWidth = Math.floor((process.stdout.columns - 4) / 2);

  return (
    <Box flexDirection="column" width="100%">
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          {task.name}
        </Text>
        <Text color="gray" dimColor>
          [Esc] back
        </Text>
      </Box>
      <Box flexDirection="row" width="100%">
        <Box width={panelWidth}>
          <SpecViewer content={specContent} height={panelHeight} title="Spec" />
        </Box>
        <Box width={panelWidth}>
          <LogViewer
            content={logContent}
            height={panelHeight}
            isStreaming={isStreaming && task.status === "in_progress"}
          />
        </Box>
      </Box>
    </Box>
  );
}
