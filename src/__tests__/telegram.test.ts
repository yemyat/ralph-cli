import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { TelegramConfig } from "../types";
import {
  formatNotificationMessage,
  type NotificationPayload,
  sendTelegramNotification,
} from "../utils/telegram";

describe("Telegram Utilities", () => {
  describe("formatNotificationMessage()", () => {
    it("formats iteration success message correctly", () => {
      const payload: NotificationPayload = {
        projectName: "my-project",
        mode: "build",
        sessionId: "abc123",
        iteration: 5,
        status: "iteration_success",
        currentSpec: "011-telegram-notifications",
      };

      const message = formatNotificationMessage(payload);

      expect(message).toContain("[Ralph] my-project");
      expect(message).toContain("Mode: build");
      expect(message).toContain("Session: abc123");
      expect(message).toContain("Iteration: 5 ✓");
      expect(message).toContain("Spec: 011-telegram-notifications");
      expect(message).toContain("Status: Completed");
    });

    it("formats iteration failure message correctly", () => {
      const payload: NotificationPayload = {
        projectName: "my-project",
        mode: "build",
        sessionId: "def456",
        iteration: 3,
        status: "iteration_failure",
        currentSpec: "007-feature",
      };

      const message = formatNotificationMessage(payload);

      expect(message).toContain("Iteration: 3 ✗");
      expect(message).toContain("Status: Failed");
    });

    it("formats loop completed message correctly", () => {
      const payload: NotificationPayload = {
        projectName: "my-project",
        mode: "build",
        sessionId: "ghi789",
        iteration: 10,
        status: "loop_completed",
        currentSpec: "011-telegram-notifications",
      };

      const message = formatNotificationMessage(payload);

      expect(message).toContain("Iteration: 10 🎉");
      expect(message).toContain("Status: All tasks completed");
    });

    it("formats loop stopped message correctly", () => {
      const payload: NotificationPayload = {
        projectName: "my-project",
        mode: "build",
        sessionId: "jkl012",
        iteration: 7,
        status: "loop_stopped",
        currentSpec: "008-feature",
      };

      const message = formatNotificationMessage(payload);

      expect(message).toContain("Iteration: 7 ⏹");
      expect(message).toContain("Status: Stopped by user");
    });

    it("formats loop started message correctly", () => {
      const payload: NotificationPayload = {
        projectName: "my-project",
        mode: "build",
        sessionId: "mno345",
        iteration: 0,
        status: "loop_started",
        currentSpec: "Telegram Notifications on Iteration Completion",
      };

      const message = formatNotificationMessage(payload);

      expect(message).toContain("[Ralph] my-project");
      expect(message).toContain("Mode: build");
      expect(message).toContain("Iteration: 0 🚀");
      expect(message).toContain(
        "Spec: Telegram Notifications on Iteration Completion"
      );
      expect(message).toContain("Status: Loop started");
    });

    it("omits spec line for plan mode (no spec)", () => {
      const payload: NotificationPayload = {
        projectName: "my-project",
        mode: "plan",
        sessionId: "abc123",
        iteration: 2,
        status: "iteration_success",
        // No currentSpec
      };

      const message = formatNotificationMessage(payload);

      expect(message).toContain("Mode: plan");
      expect(message).not.toContain("Spec:");
    });
  });

  describe("sendTelegramNotification()", () => {
    const originalFetch = globalThis.fetch;
    let mockFetch: ReturnType<typeof mock>;

    beforeEach(() => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('{"ok":true}'),
        })
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("returns false when notifications are disabled", async () => {
      const config: TelegramConfig = {
        botToken: "123:ABC",
        chatId: "12345",
        enabled: false,
      };

      const payload: NotificationPayload = {
        projectName: "test",
        mode: "build",
        sessionId: "abc",
        iteration: 1,
        status: "iteration_success",
      };

      const result = await sendTelegramNotification(config, payload);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends notification to Telegram API when enabled", async () => {
      const config: TelegramConfig = {
        botToken: "123456:ABC-DEF",
        chatId: "-1001234567890",
        enabled: true,
      };

      const payload: NotificationPayload = {
        projectName: "test-project",
        mode: "build",
        sessionId: "xyz789",
        iteration: 3,
        status: "iteration_success",
        currentSpec: "011-telegram",
      };

      const result = await sendTelegramNotification(config, payload);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit | undefined,
      ];
      expect(url).toBe(
        "https://api.telegram.org/bot123456:ABC-DEF/sendMessage"
      );
      expect(options?.method).toBe("POST");
      expect(options?.headers).toEqual({
        "Content-Type": "application/json",
      });

      const body = JSON.parse(options?.body as string);
      expect(body.chat_id).toBe("-1001234567890");
      expect(body.text).toContain("[Ralph] test-project");
    });

    it("returns false when Telegram API returns error", async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () =>
            Promise.resolve('{"ok":false,"description":"Unauthorized"}'),
        })
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const config: TelegramConfig = {
        botToken: "invalid-token",
        chatId: "12345",
        enabled: true,
      };

      const payload: NotificationPayload = {
        projectName: "test",
        mode: "build",
        sessionId: "abc",
        iteration: 1,
        status: "iteration_success",
      };

      const result = await sendTelegramNotification(config, payload);

      expect(result).toBe(false);
    });

    it("returns false and handles network errors gracefully", async () => {
      mockFetch = mock(() => Promise.reject(new Error("Network error")));
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const config: TelegramConfig = {
        botToken: "123:ABC",
        chatId: "12345",
        enabled: true,
      };

      const payload: NotificationPayload = {
        projectName: "test",
        mode: "build",
        sessionId: "abc",
        iteration: 1,
        status: "iteration_success",
      };

      // Should not throw
      const result = await sendTelegramNotification(config, payload);

      expect(result).toBe(false);
    });
  });
});
