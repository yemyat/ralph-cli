import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { BaseAgent } from "../../agents/base";
import type {
  Implementation,
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

// Mock the modules
const mockSaveImplementation = mock(() => Promise.resolve());
const mockNotifyTelegram = mock(() => Promise.resolve());

mock.module("../../utils/implementation", () => ({
  markTaskBlocked: (
    impl: Implementation,
    specId: string,
    taskId: string,
    reason: string
  ) => {
    const spec = impl.specs.find((s) => s.id === specId);
    if (spec) {
      const task = spec.tasks.find((t) => t.id === taskId);
      if (task) {
        task.status = "blocked";
        task.blockedReason = reason;
      }
    }
  },
  markTaskCompleted: (impl: Implementation, specId: string, taskId: string) => {
    const spec = impl.specs.find((s) => s.id === specId);
    if (spec) {
      const task = spec.tasks.find((t) => t.id === taskId);
      if (task) {
        task.status = "completed";
        task.completedAt = new Date().toISOString();
      }
      const allCompleted = spec.tasks.every((t) => t.status === "completed");
      if (allCompleted) {
        spec.status = "completed";
      }
    }
  },
  markTaskFailed: (impl: Implementation, specId: string, taskId: string) => {
    const spec = impl.specs.find((s) => s.id === specId);
    if (spec) {
      const task = spec.tasks.find((t) => t.id === taskId);
      if (task) {
        task.status = "failed";
        task.retryCount = (task.retryCount || 0) + 1;
      }
    }
  },
  resetTaskToPending: (
    impl: Implementation,
    specId: string,
    taskId: string
  ) => {
    const spec = impl.specs.find((s) => s.id === specId);
    if (spec) {
      const task = spec.tasks.find((t) => t.id === taskId);
      if (task) {
        task.status = "pending";
      }
    }
  },
  saveImplementation: mockSaveImplementation,
}));

mock.module("../notifications", () => ({
  notifyTelegram: mockNotifyTelegram,
}));

/**
 * Create a mock spec entry for testing.
 */
function createMockSpec(overrides?: Partial<SpecEntry>): SpecEntry {
  return {
    id: "spec-001",
    file: "spec-001.md",
    name: "Test Spec",
    priority: 1,
    status: "in_progress",
    tasks: [
      {
        id: "task-001",
        description: "Test task",
        status: "in_progress",
      },
    ],
    ...overrides,
  };
}

/**
 * Create a mock task entry for testing.
 */
function createMockTask(overrides?: Partial<TaskEntry>): TaskEntry {
  return {
    id: "task-001",
    description: "Test task",
    status: "in_progress",
    retryCount: 0,
    ...overrides,
  };
}

/**
 * Create a mock implementation for testing.
 */
function createMockImplementation(
  specs?: SpecEntry[],
  overrides?: Partial<Implementation>
): Implementation {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "build-mode",
    specs: specs || [createMockSpec()],
    qualityGates: ["bun run typecheck", "bun run test"],
    ...overrides,
  };
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
    mockSaveImplementation.mockClear();
    mockNotifyTelegram.mockClear();
  });

  afterEach(() => {
    mockSaveImplementation.mockClear();
    mockNotifyTelegram.mockClear();
  });

  describe("handleBlockedTask()", () => {
    it("marks task as blocked with the provided reason", async () => {
      const task = createMockTask();
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();

      await handleBlockedTask(impl, ctx, {
        spec,
        task,
        reason: "Missing dependency",
      });

      // Verify task status was updated
      const updatedTask = impl.specs[0].tasks[0];
      expect(updatedTask.status).toBe("blocked");
      expect(updatedTask.blockedReason).toBe("Missing dependency");
    });

    it("saves implementation after marking task as blocked", async () => {
      const task = createMockTask();
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();

      await handleBlockedTask(impl, ctx, {
        spec,
        task,
        reason: "Cannot proceed",
      });

      expect(mockSaveImplementation).toHaveBeenCalledTimes(1);
      expect(mockSaveImplementation).toHaveBeenCalledWith(
        ctx.projectPath,
        impl
      );
    });

    it("handles undefined reason by using 'Unknown' as default", async () => {
      const task = createMockTask();
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();

      await handleBlockedTask(impl, ctx, {
        spec,
        task,
        reason: undefined,
      });

      // Verify "Unknown" is used for undefined reason
      const updatedTask = impl.specs[0].tasks[0];
      expect(updatedTask.status).toBe("blocked");
      expect(updatedTask.blockedReason).toBe("Unknown");
    });
  });

  describe("handleGatesPassed()", () => {
    it("marks task as completed and saves implementation", async () => {
      const task = createMockTask();
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();
      const taskCtx: TaskContext = { spec, task };

      await handleGatesPassed(impl, ctx, taskCtx);

      // Verify task is marked completed
      const updatedTask = impl.specs[0].tasks[0];
      expect(updatedTask.status).toBe("completed");
      expect(updatedTask.completedAt).toBeDefined();

      // Verify implementation was saved
      expect(mockSaveImplementation).toHaveBeenCalledTimes(1);
      expect(mockSaveImplementation).toHaveBeenCalledWith(
        ctx.projectPath,
        impl
      );
    });

    it("sends telegram notification with iteration_success status", async () => {
      const task = createMockTask({ description: "Complete the feature" });
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();
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
      const task = createMockTask();
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();
      const taskCtx: TaskContext = { spec, task };

      await handleGatesPassed(impl, ctx, taskCtx);

      // Verify spec is marked completed
      expect(impl.specs[0].status).toBe("completed");

      // Verify log was called for spec completion
      expect(ctx.log).toHaveBeenCalledWith(`Spec completed: ${spec.name}`);
    });
  });

  describe("handleGatesFailed()", () => {
    it("retries task when under max retries", async () => {
      const task = createMockTask({ retryCount: 0 });
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();
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

      // Verify task was marked failed then reset to pending
      const updatedTask = impl.specs[0].tasks[0];
      expect(updatedTask.status).toBe("pending");
      expect(updatedTask.retryCount).toBe(1);

      // Verify telegram was NOT called for retry
      expect(mockNotifyTelegram).not.toHaveBeenCalled();
    });

    it("calls runRetryTask callback when retrying", async () => {
      const task = createMockTask({ retryCount: 1 });
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();
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
      const task = createMockTask({
        description: "Failing task",
        retryCount: 3,
      });
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();
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

      // Verify task remains failed
      const updatedTask = impl.specs[0].tasks[0];
      expect(updatedTask.status).toBe("failed");
      expect(updatedTask.retryCount).toBe(4);

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
      const task = createMockTask({ retryCount: 3 });
      const spec = createMockSpec({ tasks: [task] });
      const impl = createMockImplementation([spec]);
      const ctx = createMockLoopContext();
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
      expect(impl.specs[0].tasks[0].status).toBe("failed");
    });
  });
});
