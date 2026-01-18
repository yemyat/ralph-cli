import type {
  NotificationContext,
  NotificationPayload,
  NotificationServiceOptions,
  NotificationStatus,
  NotificationsConfig,
} from "../types";
import { sendTelegramNotification } from "../utils/telegram";

export class NotificationService {
  private readonly config: NotificationsConfig | undefined;
  private readonly context: NotificationContext;
  private readonly log: (msg: string) => void;

  constructor(options: NotificationServiceOptions) {
    this.config = options.config;
    this.context = options.context;
    this.log = options.log;
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
      this.log(`Telegram notification failed: ${err}`);
    }
  }
}
