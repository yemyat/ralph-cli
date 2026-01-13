import { Box, Text } from "ink";
import type React from "react";
import { LogViewer } from "./log-viewer.js";
import { SpecViewer } from "./spec-viewer.js";
import type { Task } from "./utils.js";

export type FocusedPanel = "spec" | "logs";

interface DetailViewProps {
  task: Task;
  specContent: string;
  logContent: string;
  isStreaming: boolean;
  height: number;
  focusedPanel: FocusedPanel;
  specScrollOffset: number;
  logsScrollOffset: number;
  autoFollow: boolean;
}

export function DetailView({
  task,
  specContent,
  logContent,
  isStreaming,
  height,
  focusedPanel,
  specScrollOffset,
  logsScrollOffset,
  autoFollow,
}: DetailViewProps): React.ReactElement {
  // Build hint text based on context
  const getHintText = (): string => {
    const hints = ["[Esc] back", "[Tab] switch", "[j/k] scroll"];
    if (focusedPanel === "logs") {
      hints.push("[f] follow");
    }
    return hints.join("  ");
  };

  // For backlog items, show spec only (full width)
  if (task.status === "backlog") {
    return (
      <Box flexDirection="column" width="100%">
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color="cyan">
            {task.name}
          </Text>
          <Text color="gray" dimColor>
            [Esc] back [j/k] scroll
          </Text>
        </Box>
        <SpecViewer
          content={specContent}
          height={height - 3}
          isFocused={true}
          scrollOffset={specScrollOffset}
          title="Spec"
        />
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
          {getHintText()}
        </Text>
      </Box>
      <Box flexDirection="row" width="100%">
        <Box width={panelWidth}>
          <SpecViewer
            content={specContent}
            height={panelHeight}
            isFocused={focusedPanel === "spec"}
            scrollOffset={specScrollOffset}
            title="Spec"
          />
        </Box>
        <Box width={panelWidth}>
          <LogViewer
            autoFollow={autoFollow}
            content={logContent}
            height={panelHeight}
            isFocused={focusedPanel === "logs"}
            isStreaming={isStreaming && task.status === "in_progress"}
            scrollOffset={logsScrollOffset}
          />
        </Box>
      </Box>
    </Box>
  );
}
