import { TextAttributes } from "@opentui/core";
import type React from "react";
import type { TaskStatus } from "./utils";

interface CardProps {
  name: string;
  status: TaskStatus;
  isSelected: boolean;
}

export function Card({ name, status, isSelected }: CardProps): React.ReactNode {
  const getIcon = (): string => {
    switch (status) {
      case "backlog":
        return "○";
      case "in_progress":
        return "●";
      case "completed":
        return "✓";
      case "stopped":
        return "■";
      default:
        return "?";
    }
  };

  const getColor = (): string => {
    if (isSelected) {
      return "#00FFFF";
    }
    switch (status) {
      case "backlog":
        return "#FFFFFF";
      case "in_progress":
        return "#FFFF00";
      case "completed":
        return "#00FF00";
      case "stopped":
        return "#FF0000";
      default:
        return "#808080";
    }
  };

  const content = ` ${getIcon()} ${name} `;

  if (isSelected) {
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional bitwise OR for TextAttributes
    const selectedAttrs = TextAttributes.BOLD | TextAttributes.INVERSE;
    return (
      <box>
        <text attributes={selectedAttrs} fg={getColor()}>
          {content}
        </text>
      </box>
    );
  }

  return (
    <box>
      <text fg={getColor()}>{content}</text>
    </box>
  );
}
