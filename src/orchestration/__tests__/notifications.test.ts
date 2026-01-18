import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { RalphConfig, RalphSession } from "../../types";

// Mock sendTelegramNotification
const mockSendTelegramNotification = mock(() => Promise.resolve(true));

// Mock execSync for getGitBranch
let execSyncBehavior: { result?: string; error?: Error } = {};
const mockExecSync = mock((_command: string, _options: unknown) => {
  if (execSyncBehavior.error) {
    throw execSyncBehavior.error;
  }
  return execSyncBehavior.result ?? "";
});

mock.module("node:child_process", () => ({
  execSync: mockExecSync,
}));

mock.module("../../utils/telegram", () => ({
  sendTelegramNotification: mockSendTelegramNotification,
}));

// Import after mocking
const { notifyTelegram } = await import("../notifications");

/**
 * Create a mock config for testing.
 */
function createMockConfig(overrides?: Partial<RalphConfig>): RalphConfig {
  return {
    projectName: "test-project",
    agents: {
      plan: { agent: "claude" },
      build: { agent: "claude" },
    },
    notifications: {
      telegram: {
        botToken: "test-token",
        chatId: "test-chat",
        enabled: true,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock session for testing.
 */
function createMockSession(overrides?: Partial<RalphSession>): RalphSession {
  return {
    id: "test-session-001",
    mode: "build",
    status: "running",
    iteration: 1,
    startedAt: new Date().toISOString(),
    agent: "claude",
    ...overrides,
  };
}

// Create a no-op log function for tests
function noopLog(_msg: string): void {
  // Intentionally empty - used to suppress console output in tests
}

describe("Notifications", () => {
  beforeEach(() => {
    mockSendTelegramNotification.mockClear();
    mockExecSync.mockClear();
    execSyncBehavior = {};
  });

  afterEach(() => {
    mockSendTelegramNotification.mockClear();
    mockExecSync.mockClear();
    execSyncBehavior = {};
  });

  describe("notifyTelegram()", () => {
    it("returns early if telegram notifications are disabled", async () => {
      const config = createMockConfig({
        notifications: {
          telegram: {
            botToken: "test-token",
            chatId: "test-chat",
            enabled: false,
          },
        },
      });
      const session = createMockSession();
      const logFn = mock(noopLog);

      await notifyTelegram({
        config,
        session,
        status: "iteration_success",
        log: logFn,
      });

      // Verify sendTelegramNotification was NOT called
      expect(mockSendTelegramNotification).not.toHaveBeenCalled();
      // Verify log was NOT called (no message sent)
      expect(logFn).not.toHaveBeenCalled();
    });

    it("sends notification and logs success when telegram is configured", async () => {
      mockSendTelegramNotification.mockImplementation(() =>
        Promise.resolve(true)
      );
      execSyncBehavior = { result: "main\n" };

      const config = createMockConfig();
      const session = createMockSession({ iteration: 5 });
      const logFn = mock(noopLog);

      await notifyTelegram({
        config,
        session,
        status: "iteration_success",
        log: logFn,
        taskDescription: "Complete the feature",
      });

      // Verify sendTelegramNotification was called with correct payload
      expect(mockSendTelegramNotification).toHaveBeenCalledTimes(1);
      expect(mockSendTelegramNotification).toHaveBeenCalledWith(
        config.notifications?.telegram,
        expect.objectContaining({
          projectName: "test-project",
          mode: "build",
          sessionId: "test-session-001",
          iteration: 5,
          status: "iteration_success",
          taskDescription: "Complete the feature",
        })
      );

      // Verify success was logged
      expect(logFn).toHaveBeenCalledTimes(1);
      expect(logFn).toHaveBeenCalledWith(
        "Telegram notification sent: iteration_success"
      );
    });

    it("logs failure when sendTelegramNotification returns false", async () => {
      mockSendTelegramNotification.mockImplementation(() =>
        Promise.resolve(false)
      );
      execSyncBehavior = { result: "feature-branch\n" };

      const config = createMockConfig();
      const session = createMockSession();
      const logFn = mock(noopLog);

      await notifyTelegram({
        config,
        session,
        status: "iteration_failure",
        log: logFn,
      });

      // Verify sendTelegramNotification was called
      expect(mockSendTelegramNotification).toHaveBeenCalledTimes(1);

      // Verify failure was logged
      expect(logFn).toHaveBeenCalledTimes(1);
      expect(logFn).toHaveBeenCalledWith(
        "Telegram notification failed: iteration_failure"
      );
    });
  });

  describe("getGitBranch()", () => {
    it("returns branch name when git command succeeds", async () => {
      execSyncBehavior = { result: "feature/test-branch\n" };

      const config = createMockConfig();
      const session = createMockSession();
      const logFn = mock(noopLog);

      await notifyTelegram({
        config,
        session,
        status: "loop_started",
        log: logFn,
      });

      // Verify the payload includes the branch (trimmed)
      expect(mockSendTelegramNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          branch: "feature/test-branch",
        })
      );
    });

    it("returns undefined when git command fails", async () => {
      execSyncBehavior = { error: new Error("Not a git repository") };

      const config = createMockConfig();
      const session = createMockSession();
      const logFn = mock(noopLog);

      await notifyTelegram({
        config,
        session,
        status: "loop_completed",
        log: logFn,
      });

      // Verify the payload has undefined branch
      expect(mockSendTelegramNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          branch: undefined,
        })
      );
    });
  });
});
