import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type React from "react";

interface LogViewerProps {
  content: string;
  isStreaming: boolean;
  height?: number;
}

export function LogViewer({
  content,
  isStreaming,
  height,
}: LogViewerProps): React.ReactElement {
  const lines = content.split("\n");
  const displayLines = height ? lines.slice(-(height - 4)) : lines;

  const renderLine = (line: string, index: number): React.ReactElement => {
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
  };

  return (
    <Box
      borderColor="green"
      borderStyle="single"
      flexDirection="column"
      height={height}
      paddingX={1}
      width="100%"
    >
      <Box justifyContent="flex-start" marginBottom={1}>
        <Text bold color="green">
          📜 Logs
        </Text>
        {isStreaming && (
          <Text color="yellow">
            {" "}
            <Spinner type="dots" /> streaming
          </Text>
        )}
      </Box>
      <Box flexDirection="column" overflowY="hidden">
        {displayLines.length === 0 ? (
          <Text color="gray" dimColor>
            No logs available.
          </Text>
        ) : (
          displayLines.map((line, index) => renderLine(line, index))
        )}
      </Box>
    </Box>
  );
}
