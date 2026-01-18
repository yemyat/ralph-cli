/**
 * Notification utilities for the orchestration loop.
 * Telegram and other notification integrations.
 */

import type { RalphConfig, RalphSession } from "../types";
import {
  type NotificationPayload,
  type NotificationStatus,
  sendTelegramNotification,
} from "../utils/telegram";

/**
 * Options for notifyTelegram.
 */
export interface NotifyTelegramOptions {
  config: RalphConfig;
  session: RalphSession;
  status: NotificationStatus;
  log: (msg: string) => void;
  taskDescription?: string;
}

export function getGitBranch(): string | undefined {
  try {
    const result = Bun.spawnSync(["git", "branch", "--show-current"]);
    if (result.exitCode === 0) {
      return result.stdout.toString().trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Send a Telegram notification if configured.
 * Failures are logged but don't crash the loop.
 */
export async function notifyTelegram(
  options: NotifyTelegramOptions
): Promise<void> {
  const { config, session, status, log, taskDescription } = options;
  const telegramConfig = config.notifications?.telegram;
  if (!telegramConfig?.enabled) {
    return;
  }

  const payload: NotificationPayload = {
    projectName: config.projectName,
    mode: session.mode,
    sessionId: session.id,
    iteration: session.iteration,
    status,
    workingDirectory: process.cwd(),
    branch: getGitBranch(),
    taskDescription,
  };

  const success = await sendTelegramNotification(telegramConfig, payload);
  if (success) {
    log(`Telegram notification sent: ${status}`);
  } else {
    log(`Telegram notification failed: ${status}`);
  }
}
