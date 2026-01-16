import type React from "react";
import { LogViewer } from "../../components/viewers/log-viewer";
import { SpecViewer } from "../../components/viewers/spec-viewer";
import { TOKYO_NIGHT } from "../../lib/constants";
import type { FocusedPanel, Task } from "../../types";

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
  terminalWidth: number;
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
  terminalWidth,
}: DetailViewProps): React.ReactNode {
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
      <box flexDirection="column" width="100%">
        <box justifyContent="space-between" marginBottom={1}>
          <text fg={TOKYO_NIGHT.cyan}>
            <strong>{task.name}</strong>
          </text>
          <text fg={TOKYO_NIGHT.comment}>[Esc] back [j/k] scroll</text>
        </box>
        <SpecViewer
          content={specContent}
          height={height - 3}
          isFocused={true}
          scrollOffset={specScrollOffset}
          title="Spec"
        />
      </box>
    );
  }

  // For in_progress and completed, show split view
  const panelHeight = height - 3;
  const panelWidth = Math.floor((terminalWidth - 4) / 2);

  return (
    <box flexDirection="column" width="100%">
      <box justifyContent="space-between" marginBottom={1}>
        <text fg={TOKYO_NIGHT.cyan}>
          <strong>{task.name}</strong>
        </text>
        <text fg={TOKYO_NIGHT.comment}>{getHintText()}</text>
      </box>
      <box flexDirection="row" width="100%">
        <box width={panelWidth}>
          <SpecViewer
            content={specContent}
            height={panelHeight}
            isFocused={focusedPanel === "spec"}
            scrollOffset={specScrollOffset}
            title="Spec"
          />
        </box>
        <box width={panelWidth}>
          <LogViewer
            autoFollow={autoFollow}
            content={logContent}
            height={panelHeight}
            isFocused={focusedPanel === "logs"}
            isStreaming={isStreaming && task.status === "in_progress"}
            scrollOffset={logsScrollOffset}
          />
        </box>
      </box>
    </box>
  );
}
