import type {
  HookListener,
  HookPayload,
  NotificationPayload,
  NotificationStatus,
  TelegramConfig,
  TelegramListenerOptions,
} from "../types";
import { sendTelegramNotification } from "../utils/telegram";

export class TelegramListener implements HookListener {
  private readonly config: TelegramConfig | undefined;
  private readonly onError: (err: unknown) => void;

  constructor(options: TelegramListenerOptions) {
    this.config = options.config;
    this.onError = options.onError ?? (() => undefined);
  }

  private async send(
    status: NotificationStatus,
    payload: HookPayload
  ): Promise<void> {
    if (!this.config?.enabled) {
      return;
    }

    const notificationPayload: NotificationPayload = {
      projectName: payload.projectName,
      mode: payload.mode,
      sessionId: payload.sessionId,
      iteration: payload.iteration,
      status,
      taskDescription: payload.taskDescription,
    };

    try {
      await sendTelegramNotification(this.config, notificationPayload);
    } catch (err) {
      this.onError(err);
    }
  }

  async onLoopStarted(payload: HookPayload): Promise<void> {
    await this.send("loop_started", payload);
  }

  async onIterationSuccess(payload: HookPayload): Promise<void> {
    await this.send("iteration_success", payload);
  }

  async onIterationFailure(payload: HookPayload): Promise<void> {
    await this.send("iteration_failure", payload);
  }

  async onLoopCompleted(payload: HookPayload): Promise<void> {
    await this.send("loop_completed", payload);
  }

  async onLoopStopped(payload: HookPayload): Promise<void> {
    await this.send("loop_stopped", payload);
  }
}
