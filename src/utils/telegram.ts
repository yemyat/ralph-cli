// src/utils/telegram.ts
// Telegram notification utilities

import type { TelegramConfig } from "../types";

export type NotificationStatus =
  | "loop_started"
  | "iteration_success"
  | "iteration_failure"
  | "loop_completed"
  | "loop_stopped";

export interface NotificationPayload {
  projectName: string;
  mode: "plan" | "build";
  sessionId: string;
  iteration: number;
  status: NotificationStatus;
  workingDirectory?: string;
  branch?: string;
  taskDescription?: string;
}

/**
 * Format the notification message for Telegram.
 * Uses plain text formatting for better compatibility.
 */
export function formatNotificationMessage(
  payload: NotificationPayload
): string {
  const statusEmoji = getStatusEmoji(payload.status);
  const statusText = getStatusText(payload.status);

  const lines = [
    `[Ralph] ${payload.projectName}`,
    `Mode: ${payload.mode}`,
    `Session: ${payload.sessionId}`,
    `Iteration: ${payload.iteration} ${statusEmoji}`,
  ];

  if (payload.branch) {
    lines.push(`Branch: ${payload.branch}`);
  }

  if (payload.taskDescription) {
    lines.push(`Task: ${payload.taskDescription}`);
  }

  if (payload.workingDirectory) {
    lines.push(`Dir: ${payload.workingDirectory}`);
  }

  lines.push("");
  lines.push(`Status: ${statusText}`);

  return lines.join("\n");
}

function getStatusEmoji(status: NotificationStatus): string {
  switch (status) {
    case "loop_started":
      return "🚀";
    case "iteration_success":
      return "✓";
    case "iteration_failure":
      return "✗";
    case "loop_completed":
      return "🎉";
    case "loop_stopped":
      return "⏹";
    default:
      return "•";
  }
}

function getStatusText(status: NotificationStatus): string {
  switch (status) {
    case "loop_started":
      return "Loop started";
    case "iteration_success":
      return "Completed";
    case "iteration_failure":
      return "Failed";
    case "loop_completed":
      return "All tasks completed";
    case "loop_stopped":
      return "Stopped by user";
    default:
      return "Unknown";
  }
}

/**
 * Send a notification to Telegram.
 * Uses the Telegram Bot API sendMessage endpoint.
 *
 * @param config - Telegram configuration with bot token and chat ID
 * @param payload - Notification payload with project details
 * @returns Promise that resolves to true if successful, false if failed
 */
export async function sendTelegramNotification(
  config: TelegramConfig,
  payload: NotificationPayload
): Promise<boolean> {
  if (!config.enabled) {
    return false;
  }

  const message = formatNotificationMessage(payload);
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: undefined, // Plain text for better compatibility
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(
        `Telegram notification failed: ${response.status} - ${errorBody}`
      );
      return false;
    }

    return true;
  } catch (error) {
    // Log warning but don't crash the loop
    console.warn(`Telegram notification error: ${error}`);
    return false;
  }
}
