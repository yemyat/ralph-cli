import type React from "react";

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
      <text fg="#00FFFF" key={index}>
        <strong>{trimmed.slice(2)}</strong>
      </text>
    );
  }
  if (trimmed.startsWith("## ")) {
    return (
      <text fg="#0000FF" key={index}>
        <strong>{trimmed}</strong>
      </text>
    );
  }
  if (trimmed.startsWith("### ")) {
    return (
      <text fg="#FFFFFF" key={index}>
        <strong>{trimmed}</strong>
      </text>
    );
  }

  // Completed tasks
  if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
    return (
      <text fg="#00FF00" key={index}>
        ✓ {trimmed.slice(6)}
      </text>
    );
  }

  // Incomplete tasks
  if (trimmed.startsWith("- [ ]")) {
    return (
      <text fg="#FFFF00" key={index}>
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
      <text fg="#808080" key={index}>
        {trimmed}
      </text>
    );
  }

  // Code blocks
  if (trimmed.startsWith("```")) {
    return (
      <text fg="#808080" key={index}>
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
  const borderColor = isFocused ? "#00FFFF" : "#0000FF";
  const titleColor = isFocused ? "#00FFFF" : "#0000FF";

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
          <strong>📄 {title}</strong>
        </text>
        <box>
          <text fg="#808080">{scrollIndicator} </text>
          <text fg="#808080">[{scrollPosition}]</text>
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
