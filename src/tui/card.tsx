import { TextAttributes } from "@opentui/core";
import type React from "react";
import { STATUS_COLORS, STATUS_ICONS, TOKYO_NIGHT } from "./lib/constants";
import type { TaskStatus } from "./types";

interface CardProps {
  name: string;
  status: TaskStatus;
  isSelected: boolean;
}

export function Card({ name, status, isSelected }: CardProps): React.ReactNode {
  const icon = STATUS_ICONS[status] ?? "?";
  const color = isSelected
    ? TOKYO_NIGHT.cyan
    : (STATUS_COLORS[status] ?? TOKYO_NIGHT.comment);
  const content = ` ${icon} ${name} `;

  if (isSelected) {
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional bitwise OR for TextAttributes
    const selectedAttrs = TextAttributes.BOLD | TextAttributes.INVERSE;
    return (
      <box>
        <text attributes={selectedAttrs} fg={color}>
          {content}
        </text>
      </box>
    );
  }

  return (
    <box>
      <text fg={color}>{content}</text>
    </box>
  );
}
