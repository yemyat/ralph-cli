import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { BaseAgent } from "../../agents/base";
import { Implementation } from "../../domain";
import type {
  RalphConfig,
  RalphSession,
  SpecEntry,
  TaskEntry,
} from "../../types";

import {
  handleBlockedTask,
  handleGatesFailed,
  handleGatesPassed,
} from "../task-handlers";
import type { LoopContext, TaskContext } from "../types";

// Mock the notifications module
const mockNotifyTelegram = mock(() => Promise.resolve());

mock.module("../notifications", () => ({
  notifyTelegram: mockNotifyTelegram,
}));

/**
 * Create a mock task entry for testing.
 */
function createMockTaskEntry(overrides?: Partial<TaskEntry>): TaskEntry {
  return {
    id: "task-001",
    description: "Test task",
    status: "in_progress",
    retryCount: 0,
    ...overrides,
  };
}

/**
 * Create a mock spec entry for testing.
 */
function createMockSpecEntry(overrides?: Partial<SpecEntry>): SpecEntry {
  return {
    id: "spec-001",
    file: "spec-001.md",
    name: "Test Spec",
    priority: 1,
    status: "in_progress",
    tasks: [createMockTaskEntry()],
    ...overrides,
  };
}

/**
 * Create a mock Implementation for testing.
 * Uses a spy on the save method to track calls.
 */
function createMockImplementation(
  specEntries?: SpecEntry[],
  projectPath = "/tmp/test-project"
): { impl: Implementation; saveSpy: ReturnType<typeof mock> } {
  const specs = specEntries ?? [createMockSpecEntry()];
  const impl = new Implementation(projectPath, {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "build-mode",
    specs,
    qualityGates: ["bun run typecheck", "bun run test"],
  });

  // Create a spy for the save method
  const saveSpy = mock(() => Promise.resolve());
  impl.save = saveSpy;

  return { impl, saveSpy };
}

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
        enabled: false,
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

/**
 * Create a mock loop context for testing.
 */
function createMockLoopContext(overrides?: Partial<LoopContext>): LoopContext {
  return {
    projectPath: "/tmp/test-project",
    config: createMockConfig(),
    session: createMockSession(),
    agent: {} as BaseAgent,
    log: mock(noopLog),
    verbose: false,
    ...overrides,
  };
}

describe("Task Handlers", () => {
  beforeEach(() => {
    mockNotifyTelegram.mockClear();
  });

  afterEach(() => {
    mockNotifyTelegram.mockClear();
  });

  describe("handleBlockedTask()", () => {
    it("marks task as blocked with the provided reason", async () => {
      const taskEntry = createMockTaskEntry();
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl, saveSpy } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      // Get domain objects from implementation
      const spec = impl.specs[0];
      const task = spec.tasks[0];

      await handleBlockedTask(impl, ctx, {
        spec,
        task,
        reason: "Missing dependency",
      });

      // Verify task status was updated
      expect(task.status).toBe("blocked");
      expect(task.blockedReason).toBe("Missing dependency");
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("saves implementation after marking task as blocked", async () => {
      const taskEntry = createMockTaskEntry();
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl, saveSpy } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      const spec = impl.specs[0];
      const task = spec.tasks[0];

      await handleBlockedTask(impl, ctx, {
        spec,
        task,
        reason: "Cannot proceed",
      });

      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("handles undefined reason by using 'Unknown' as default", async () => {
      const taskEntry = createMockTaskEntry();
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      const spec = impl.specs[0];
      const task = spec.tasks[0];

      await handleBlockedTask(impl, ctx, {
        spec,
        task,
        reason: undefined,
      });

      // Verify "Unknown" is used for undefined reason
      expect(task.status).toBe("blocked");
      expect(task.blockedReason).toBe("Unknown");
    });
  });

  describe("handleGatesPassed()", () => {
    it("marks task as completed and saves implementation", async () => {
      const taskEntry = createMockTaskEntry();
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl, saveSpy } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      const spec = impl.specs[0];
      const task = spec.tasks[0];
      const taskCtx: TaskContext = { spec, task };

      await handleGatesPassed(impl, ctx, taskCtx);

      // Verify task is marked completed
      expect(task.status).toBe("completed");
      expect(task.completedAt).toBeDefined();

      // Verify implementation was saved
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("sends telegram notification with iteration_success status", async () => {
      const taskEntry = createMockTaskEntry({
        description: "Complete the feature",
      });
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      const spec = impl.specs[0];
      const task = spec.tasks[0];
      const taskCtx: TaskContext = { spec, task };

      await handleGatesPassed(impl, ctx, taskCtx);

      expect(mockNotifyTelegram).toHaveBeenCalledTimes(1);
      expect(mockNotifyTelegram).toHaveBeenCalledWith({
        config: ctx.config,
        session: ctx.session,
        status: "iteration_success",
        log: ctx.log,
        taskDescription: "Complete the feature",
      });
    });

    it("detects and logs when spec becomes completed", async () => {
      // Create spec with only one task (completing it completes the spec)
      const taskEntry = createMockTaskEntry();
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      const spec = impl.specs[0];
      const task = spec.tasks[0];
      const taskCtx: TaskContext = { spec, task };

      await handleGatesPassed(impl, ctx, taskCtx);

      // Verify spec is marked completed (via isCompleted getter)
      expect(spec.isCompleted).toBe(true);

      // Verify log was called for spec completion
      expect(ctx.log).toHaveBeenCalledWith(`Spec completed: ${spec.name}`);
    });
  });

  describe("handleGatesFailed()", () => {
    it("retries task when under max retries", async () => {
      const taskEntry = createMockTaskEntry({ retryCount: 0 });
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl, saveSpy } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      const spec = impl.specs[0];
      const task = spec.tasks[0];
      const taskCtx: TaskContext = { spec, task };
      const failedGates = [
        { name: "typecheck", passed: false, output: "Type error", exitCode: 1 },
      ];

      await handleGatesFailed(impl, ctx, {
        taskCtx,
        failedGates,
        retryOptions: {
          maxRetries: 3,
          runRetryTask: undefined,
        },
      });

      // Verify task was retried (incremented count, set to pending)
      expect(task.status).toBe("pending");
      expect(task.retryCount).toBe(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Verify telegram was NOT called for retry
      expect(mockNotifyTelegram).not.toHaveBeenCalled();
    });

    it("calls runRetryTask callback when retrying", async () => {
      const taskEntry = createMockTaskEntry({ retryCount: 1 });
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      const spec = impl.specs[0];
      const task = spec.tasks[0];
      const taskCtx: TaskContext = { spec, task };
      const failedGates = [
        { name: "test", passed: false, output: "Test failed", exitCode: 1 },
      ];
      const runRetryTask = mock(() => Promise.resolve());

      await handleGatesFailed(impl, ctx, {
        taskCtx,
        failedGates,
        retryOptions: {
          maxRetries: 3,
          runRetryTask,
        },
      });

      // Verify runRetryTask was called with correct arguments
      expect(runRetryTask).toHaveBeenCalledTimes(1);
      expect(runRetryTask).toHaveBeenCalledWith(spec, task, failedGates, 1);
    });

    it("sends failure notification when max retries exceeded", async () => {
      const taskEntry = createMockTaskEntry({
        description: "Failing task",
        retryCount: 3,
      });
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl, saveSpy } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      const spec = impl.specs[0];
      const task = spec.tasks[0];
      const taskCtx: TaskContext = { spec, task };
      const failedGates = [
        { name: "build", passed: false, output: "Build failed", exitCode: 1 },
      ];

      await handleGatesFailed(impl, ctx, {
        taskCtx,
        failedGates,
        retryOptions: {
          maxRetries: 3,
          runRetryTask: undefined,
        },
      });

      // Verify task is marked failed
      expect(task.status).toBe("failed");
      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Verify failure notification was sent
      expect(mockNotifyTelegram).toHaveBeenCalledTimes(1);
      expect(mockNotifyTelegram).toHaveBeenCalledWith({
        config: ctx.config,
        session: ctx.session,
        status: "iteration_failure",
        log: ctx.log,
        taskDescription: "Failing task",
      });
    });

    it("does not call runRetryTask when max retries exceeded", async () => {
      const taskEntry = createMockTaskEntry({ retryCount: 3 });
      const specEntry = createMockSpecEntry({ tasks: [taskEntry] });
      const { impl } = createMockImplementation([specEntry]);
      const ctx = createMockLoopContext();

      const spec = impl.specs[0];
      const task = spec.tasks[0];
      const taskCtx: TaskContext = { spec, task };
      const failedGates = [
        { name: "lint", passed: false, output: "Lint error", exitCode: 1 },
      ];
      const runRetryTask = mock(() => Promise.resolve());

      await handleGatesFailed(impl, ctx, {
        taskCtx,
        failedGates,
        retryOptions: {
          maxRetries: 3,
          runRetryTask,
        },
      });

      // Verify runRetryTask was NOT called
      expect(runRetryTask).not.toHaveBeenCalled();

      // Verify task is marked as failed (not pending)
      expect(task.status).toBe("failed");
    });
  });
});
