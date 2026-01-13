import { Box, Text } from "ink";
import type React from "react";

interface SpecViewerProps {
  content: string;
  title: string;
  height?: number;
  isFocused?: boolean;
  scrollOffset?: number;
}

// Render a single markdown line with styling
function renderMarkdownLine(line: string, index: number): React.ReactElement {
  const trimmed = line.trim();

  // Headers
  if (trimmed.startsWith("# ")) {
    return (
      <Text bold color="cyan" key={index}>
        {trimmed.slice(2)}
      </Text>
    );
  }
  if (trimmed.startsWith("## ")) {
    return (
      <Text bold color="blue" key={index}>
        {trimmed}
      </Text>
    );
  }
  if (trimmed.startsWith("### ")) {
    return (
      <Text bold color="white" key={index}>
        {trimmed}
      </Text>
    );
  }

  // Completed tasks
  if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
    return (
      <Text color="green" key={index}>
        ✓ {trimmed.slice(6)}
      </Text>
    );
  }

  // Incomplete tasks
  if (trimmed.startsWith("- [ ]")) {
    return (
      <Text color="yellow" key={index}>
        ○ {trimmed.slice(6)}
      </Text>
    );
  }

  // Regular list items
  if (trimmed.startsWith("- ")) {
    return <Text key={index}>• {trimmed.slice(2)}</Text>;
  }

  // Comments
  if (trimmed.startsWith("<!--")) {
    return (
      <Text color="gray" dimColor key={index}>
        {trimmed}
      </Text>
    );
  }

  // Code blocks
  if (trimmed.startsWith("```")) {
    return (
      <Text color="gray" key={index}>
        {trimmed}
      </Text>
    );
  }

  // Regular text
  return <Text key={index}>{line}</Text>;
}

export function SpecViewer({
  content,
  title,
  height,
  isFocused = false,
  scrollOffset = 0,
}: SpecViewerProps): React.ReactElement {
  const lines = content.split("\n");
  const totalLines = lines.length;

  // Calculate visible content area (height minus borders, header, padding)
  const viewportHeight = height ? height - 4 : totalLines;

  // Clamp scroll offset to valid range
  const maxOffset = Math.max(0, totalLines - viewportHeight);
  const clampedOffset = Math.min(Math.max(0, scrollOffset), maxOffset);

  // Get lines to display based on scroll offset
  const displayLines = lines.slice(
    clampedOffset,
    clampedOffset + viewportHeight
  );

  // Determine scroll indicators
  const hasMoreAbove = clampedOffset > 0;
  const hasMoreBelow = clampedOffset + viewportHeight < totalLines;

  // Calculate scroll position display
  const currentLine = clampedOffset + 1;
  const endLine = Math.min(clampedOffset + viewportHeight, totalLines);
  const scrollPosition = `${currentLine}-${endLine}/${totalLines}`;

  // Border color changes based on focus
  const borderColor = isFocused ? "cyan" : "blue";

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

  return (
    <Box
      borderColor={borderColor}
      borderStyle={isFocused ? "bold" : "single"}
      flexDirection="column"
      height={height}
      paddingX={1}
      width="100%"
    >
      {/* Header with title and scroll info */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={isFocused ? "cyan" : "blue"}>
          📄 {title}
        </Text>
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
        {displayLines.map((line, index) =>
          renderMarkdownLine(line, clampedOffset + index)
        )}
      </Box>
    </Box>
  );
}
