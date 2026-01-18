import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import type { RalphConfig, RalphSession } from "../../types";

// Mock sendTelegramNotification
const mockSendTelegramNotification = mock(() => Promise.resolve(true));

mock.module("../../utils/telegram", () => ({
  sendTelegramNotification: mockSendTelegramNotification,
}));

// Import only what we need (no namespace import)
import { notifyTelegram } from "../notifications";

// Spy on Bun.spawnSync to control git branch output
let bunSpawnSyncSpy: ReturnType<typeof spyOn>;
let gitBranchValue: string | undefined;

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
    gitBranchValue = undefined;

    // Mock Bun.spawnSync to control git branch output
    bunSpawnSyncSpy = spyOn(Bun, "spawnSync").mockImplementation((cmd) => {
      const cmdArray = cmd as string[];
      if (
        cmdArray[0] === "git" &&
        cmdArray[1] === "branch" &&
        cmdArray[2] === "--show-current"
      ) {
        if (gitBranchValue !== undefined) {
          return {
            exitCode: 0,
            stdout: Buffer.from(`${gitBranchValue}\n`),
            stderr: Buffer.from(""),
            success: true,
            signalCode: null,
            pid: 12_345,
            resourceUsage: () => undefined,
          } as unknown as ReturnType<typeof Bun.spawnSync>;
        }
        return {
          exitCode: 1,
          stdout: Buffer.from(""),
          stderr: Buffer.from("not a git repo"),
          success: false,
          signalCode: null,
          pid: 12_345,
          resourceUsage: () => undefined,
        } as unknown as ReturnType<typeof Bun.spawnSync>;
      }
      // For other commands, return a default failure
      return {
        exitCode: 1,
        stdout: Buffer.from(""),
        stderr: Buffer.from("unknown command"),
        success: false,
        signalCode: null,
        pid: 12_345,
        resourceUsage: () => undefined,
      } as unknown as ReturnType<typeof Bun.spawnSync>;
    });
  });

  afterEach(() => {
    mockSendTelegramNotification.mockClear();
    bunSpawnSyncSpy.mockRestore();
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
      gitBranchValue = "main";

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
      gitBranchValue = "feature-branch";

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
      gitBranchValue = "feature/test-branch";

      const config = createMockConfig();
      const session = createMockSession();
      const logFn = mock(noopLog);

      await notifyTelegram({
        config,
        session,
        status: "loop_started",
        log: logFn,
      });

      // Verify the payload includes the branch
      expect(mockSendTelegramNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          branch: "feature/test-branch",
        })
      );
    });

    it("returns undefined when git command fails", async () => {
      gitBranchValue = undefined;

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
