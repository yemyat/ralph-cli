import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type React from "react";

interface LogViewerProps {
  content: string;
  isStreaming: boolean;
  height?: number;
  isFocused?: boolean;
  scrollOffset?: number;
  autoFollow?: boolean;
}

// Render a single log line with styling
function renderLogLine(line: string, index: number): React.ReactElement {
  const trimmed = line.trim();

  // Success indicators
  if (
    trimmed.includes("✓") ||
    trimmed.includes("PASS") ||
    trimmed.includes("success")
  ) {
    return (
      <Text color="green" key={index}>
        {line}
      </Text>
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
      <Text color="red" key={index}>
        {line}
      </Text>
    );
  }

  // Warning indicators
  if (
    trimmed.includes("warning") ||
    trimmed.includes("Warning") ||
    trimmed.includes("WARN")
  ) {
    return (
      <Text color="yellow" key={index}>
        {line}
      </Text>
    );
  }

  // Command indicators
  if (trimmed.startsWith(">") || trimmed.startsWith("$")) {
    return (
      <Text color="cyan" key={index}>
        {line}
      </Text>
    );
  }

  // Regular text
  return <Text key={index}>{line}</Text>;
}

export function LogViewer({
  content,
  isStreaming,
  height,
  isFocused = false,
  scrollOffset = 0,
  autoFollow = true,
}: LogViewerProps): React.ReactElement {
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
  const borderColor = isFocused ? "cyan" : "green";

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
    <Box
      borderColor={borderColor}
      borderStyle={isFocused ? "bold" : "single"}
      flexDirection="column"
      height={height}
      paddingX={1}
      width="100%"
    >
      {/* Header with title, streaming indicator, and scroll info */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text bold color={isFocused ? "cyan" : "green"}>
            📜 Logs{followLabel}
          </Text>
          {isStreaming && (
            <Text color="yellow">
              {" "}
              <Spinner type="dots" />
            </Text>
          )}
        </Box>
        <Box>
          <Text color="gray" dimColor>
            {scrollIndicator}{" "}
          </Text>
          <Text color="gray" dimColor>
            [{scrollPosition}]
          </Text>
        </Box>
      </Box>

      {/* Content area */}
      <Box flexDirection="column" overflowY="hidden">
        {displayLines.length === 0 ||
        (displayLines.length === 1 && displayLines[0] === "") ? (
          <Text color="gray" dimColor>
            No logs available.
          </Text>
        ) : (
          displayLines.map((line, index) =>
            renderLogLine(line, effectiveOffset + index)
          )
        )}
      </Box>
    </Box>
  );
}
