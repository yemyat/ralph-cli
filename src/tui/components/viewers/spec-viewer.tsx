import type React from "react";
import { TOKYO_NIGHT } from "../../lib/constants";

interface SpecViewerProps {
  content: string;
  title: string;
  height?: number;
  isFocused?: boolean;
  scrollOffset?: number;
}

// Render a single markdown line with styling
function renderMarkdownLine(line: string, index: number): React.ReactNode {
  const trimmed = line.trim();

  // Headers
  if (trimmed.startsWith("# ")) {
    return (
      <text fg={TOKYO_NIGHT.cyan} key={index}>
        <strong>{trimmed.slice(2)}</strong>
      </text>
    );
  }
  if (trimmed.startsWith("## ")) {
    return (
      <text fg={TOKYO_NIGHT.blue} key={index}>
        <strong>{trimmed}</strong>
      </text>
    );
  }
  if (trimmed.startsWith("### ")) {
    return (
      <text fg={TOKYO_NIGHT.fg} key={index}>
        <strong>{trimmed}</strong>
      </text>
    );
  }

  // Completed tasks
  if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
    return (
      <text fg={TOKYO_NIGHT.green} key={index}>
        ✓ {trimmed.slice(6)}
      </text>
    );
  }

  // Incomplete tasks
  if (trimmed.startsWith("- [ ]")) {
    return (
      <text fg={TOKYO_NIGHT.yellow} key={index}>
        ○ {trimmed.slice(6)}
      </text>
    );
  }

  // Regular list items
  if (trimmed.startsWith("- ")) {
    return <text key={index}>• {trimmed.slice(2)}</text>;
  }

  // Comments
  if (trimmed.startsWith("<!--")) {
    return (
      <text fg={TOKYO_NIGHT.comment} key={index}>
        {trimmed}
      </text>
    );
  }

  // Code blocks
  if (trimmed.startsWith("```")) {
    return (
      <text fg={TOKYO_NIGHT.comment} key={index}>
        {trimmed}
      </text>
    );
  }

  // Regular text
  return <text key={index}>{line}</text>;
}

export function SpecViewer({
  content,
  title,
  height,
  isFocused = false,
  scrollOffset = 0,
}: SpecViewerProps): React.ReactNode {
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
  const borderColor = isFocused ? TOKYO_NIGHT.cyan : TOKYO_NIGHT.blue;
  const titleColor = isFocused ? TOKYO_NIGHT.cyan : TOKYO_NIGHT.blue;

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
      {/* Header with title and scroll info */}
      <box justifyContent="space-between" marginBottom={1}>
        <text fg={titleColor}>
          <strong>{title}</strong>
        </text>
        <box>
          <text fg={TOKYO_NIGHT.comment}>{scrollIndicator} </text>
          <text fg={TOKYO_NIGHT.comment}>[{scrollPosition}]</text>
        </box>
      </box>

      {/* Content area */}
      <box flexDirection="column">
        {displayLines.map((line, index) =>
          renderMarkdownLine(line, clampedOffset + index)
        )}
      </box>
    </box>
  );
}
