import { Box, Text } from "ink";
import type React from "react";

interface SpecViewerProps {
  content: string;
  title: string;
  height?: number;
}

export function SpecViewer({
  content,
  title,
  height,
}: SpecViewerProps): React.ReactElement {
  // Simple markdown rendering - highlight headers, tasks, etc.
  const renderLine = (line: string, index: number): React.ReactElement => {
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
  };

  const lines = content.split("\n");
  const displayLines = height ? lines.slice(0, height - 4) : lines;

  return (
    <Box
      borderColor="blue"
      borderStyle="single"
      flexDirection="column"
      height={height}
      paddingX={1}
      width="100%"
    >
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="blue">
          📄 {title}
        </Text>
        <Text color="gray" dimColor>
          [Esc] back
        </Text>
      </Box>
      <Box flexDirection="column" overflowY="hidden">
        {displayLines.map((line, index) => renderLine(line, index))}
        {height && lines.length > height - 4 && (
          <Text color="gray" dimColor>
            ... ({lines.length - height + 4} more lines)
          </Text>
        )}
      </Box>
    </Box>
  );
}
