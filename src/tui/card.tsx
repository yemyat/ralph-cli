import { Box, Text } from "ink";
import type React from "react";
import type { TaskStatus } from "./utils.js";

interface CardProps {
  name: string;
  status: TaskStatus;
  isSelected: boolean;
}

export function Card({
  name,
  status,
  isSelected,
}: CardProps): React.ReactElement {
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
      return "cyan";
    }
    switch (status) {
      case "backlog":
        return "white";
      case "in_progress":
        return "yellow";
      case "completed":
        return "green";
      case "stopped":
        return "red";
      default:
        return "gray";
    }
  };

  return (
    <Box>
      <Text bold={isSelected} color={getColor()} inverse={isSelected}>
        {` ${getIcon()} ${name} `}
      </Text>
    </Box>
  );
}
