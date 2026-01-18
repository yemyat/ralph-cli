import type {
  NotificationContext,
  NotificationPayload,
  NotificationServiceOptions,
  NotificationStatus,
  NotificationsConfig,
} from "../types";
import { sendTelegramNotification } from "../utils/telegram";
import type { LoggerService } from "./logger-service";

export class NotificationService {
  private readonly config: NotificationsConfig | undefined;
  private readonly context: NotificationContext;
  private readonly logger: LoggerService | null;

  constructor(options: NotificationServiceOptions) {
    this.config = options.config;
    this.context = options.context;
    this.logger = options.logger ?? null;
  }

  async notify(
    status: NotificationStatus,
    iteration: number,
    taskDescription?: string
  ): Promise<void> {
    const telegram = this.config?.telegram;
    if (!telegram?.enabled) {
      return;
    }

    const payload: NotificationPayload = {
      projectName: this.context.projectName,
      mode: this.context.mode,
      sessionId: this.context.sessionId,
      iteration,
      status,
      taskDescription,
    };

    try {
      await sendTelegramNotification(telegram, payload);
    } catch (err) {
      this.logger?.log(`Telegram notification failed: ${err}`);
    }
  }
}
