import type React from "react";
import { LoadingSpinner } from "./loading-spinner";

interface LogViewerProps {
  content: string;
  isStreaming: boolean;
  height?: number;
  isFocused?: boolean;
  scrollOffset?: number;
  autoFollow?: boolean;
}

// Render a single log line with styling
function renderLogLine(line: string, index: number): React.ReactNode {
  const trimmed = line.trim();

  // Success indicators
  if (
    trimmed.includes("✓") ||
    trimmed.includes("PASS") ||
    trimmed.includes("success")
  ) {
    return (
      <text fg="#00FF00" key={index}>
        {line}
      </text>
    );
  }

  // Error indicators
  if (
    trimmed.includes("✗") ||
    trimmed.includes("FAIL") ||
    trimmed.includes("error") ||
    trimmed.includes("Error")
  ) {
    return (
      <text fg="#FF0000" key={index}>
        {line}
      </text>
    );
  }

  // Warning indicators
  if (
    trimmed.includes("warning") ||
    trimmed.includes("Warning") ||
    trimmed.includes("WARN")
  ) {
    return (
      <text fg="#FFFF00" key={index}>
        {line}
      </text>
    );
  }

  // Command indicators
  if (trimmed.startsWith(">") || trimmed.startsWith("$")) {
    return (
      <text fg="#00FFFF" key={index}>
        {line}
      </text>
    );
  }

  // Regular text
  return <text key={index}>{line}</text>;
}

export function LogViewer({
  content,
  isStreaming,
  height,
  isFocused = false,
  scrollOffset = 0,
  autoFollow = true,
}: LogViewerProps): React.ReactNode {
  const lines = content.split("\n");
  const totalLines = lines.length;

  // Calculate visible content area (height minus borders, header, padding)
  const viewportHeight = height ? height - 4 : totalLines;

  // Calculate effective scroll offset
  // If autoFollow is enabled, always show the bottom
  const maxOffset = Math.max(0, totalLines - viewportHeight);
  const effectiveOffset = autoFollow
    ? maxOffset
    : Math.min(Math.max(0, scrollOffset), maxOffset);

  // Get lines to display based on scroll offset
  const displayLines = lines.slice(
    effectiveOffset,
    effectiveOffset + viewportHeight
  );

  // Determine scroll indicators
  const hasMoreAbove = effectiveOffset > 0;
  const hasMoreBelow = effectiveOffset + viewportHeight < totalLines;

  // Calculate scroll position display
  const currentLine = effectiveOffset + 1;
  const endLine = Math.min(effectiveOffset + viewportHeight, totalLines);
  const scrollPosition =
    totalLines > 0 ? `${currentLine}-${endLine}/${totalLines}` : "0/0";

  // Border color changes based on focus
  const borderColor = isFocused ? "#00FFFF" : "#00FF00";
  const titleColor = isFocused ? "#00FFFF" : "#00FF00";

  // Build scroll indicator string
  const getScrollIndicator = (): string => {
    if (hasMoreAbove && hasMoreBelow) {
      return "▲▼";
    }
    if (hasMoreAbove) {
      return "▲ ";
    }
    if (hasMoreBelow) {
      return " ▼";
    }
    return "  ";
  };
  const scrollIndicator = getScrollIndicator();

  // Build header label
  const followLabel = autoFollow ? " (following)" : "";

  return (
    <box
      border
      borderColor={borderColor}
      borderStyle={isFocused ? "double" : "single"}
      flexDirection="column"
      height={height}
      paddingLeft={1}
      paddingRight={1}
      width="100%"
    >
      {/* Header with title, streaming indicator, and scroll info */}
      <box justifyContent="space-between" marginBottom={1}>
        <box>
          <text fg={titleColor}>
            <strong>📜 Logs{followLabel}</strong>
          </text>
          {isStreaming && (
            <text fg="#FFFF00">
              {" "}
              <LoadingSpinner />
            </text>
          )}
        </box>
        <box>
          <text fg="#808080">{scrollIndicator} </text>
          <text fg="#808080">[{scrollPosition}]</text>
        </box>
      </box>

      {/* Content area */}
      <box flexDirection="column">
        {displayLines.length === 0 ||
        (displayLines.length === 1 && displayLines[0] === "") ? (
          <text fg="#808080">No logs available.</text>
        ) : (
          displayLines.map((line, index) =>
            renderLogLine(line, effectiveOffset + index)
          )
        )}
      </box>
    </box>
  );
}
