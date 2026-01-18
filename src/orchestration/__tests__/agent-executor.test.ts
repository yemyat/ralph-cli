import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { EventEmitter, Readable, Writable } from "node:stream";
import type { BaseAgent } from "../../agents/base";
import { Spec, Task } from "../../domain";
import type {
  RalphConfig,
  RalphSession,
  SpecEntry,
  TaskEntry,
} from "../../types";
import type {
  ExecuteAgentOptions,
  LoopContext,
  RetryOptions,
  SingleTaskOptions,
} from "../types";

// Mock modules
const mockSaveSession = mock((_projectPath: string, _session: RalphSession) => {
  // No-op for testing
});
const mockGenerateTaskPrompt = mock(
  (_spec: Spec, _task: Task) => "mock task prompt"
);
const mockGenerateRetryPrompt = mock(
  (_spec: Spec, _task: Task, _failedGates: unknown[], _retryCount: number) =>
    "mock retry prompt"
);

// Create a mock child process with EventEmitter behavior
function createMockChildProcess(options: {
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  error?: Error;
}) {
  const child = new EventEmitter() as EventEmitter & {
    stdin: Writable | null;
    stdout: Readable | null;
    stderr: Readable | null;
    pid?: number;
  };

  // Create writable stdin
  child.stdin = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  // Create readable stdout
  child.stdout = new Readable({
    read() {
      // No-op for mock stream
    },
  });

  // Create readable stderr
  child.stderr = new Readable({
    read() {
      // No-op for mock stream
    },
  });

  child.pid = 12_345;

  // Schedule emissions after setup
  setImmediate(() => {
    if (options.error) {
      child.emit("error", options.error);
      return;
    }

    if (options.stdout !== undefined && child.stdout) {
      child.stdout.push(options.stdout);
      child.stdout.push(null); // End stream
    }

    if (options.stderr !== undefined && child.stderr) {
      child.stderr.push(options.stderr);
      child.stderr.push(null);
    }

    // Emit close after stdout/stderr are done
    setImmediate(() => {
      child.emit("close", options.exitCode ?? 0);
    });
  });

  return child;
}

// Mock spawn function
let spawnBehavior: {
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  error?: Error;
} = {};

const mockSpawn = mock(
  (_command: string, _args: string[], _options: unknown) => {
    return createMockChildProcess(spawnBehavior);
  }
);

mock.module("node:child_process", () => ({
  spawn: mockSpawn,
}));

mock.module("../../config", () => ({
  saveSession: mockSaveSession,
}));

mock.module("../../utils/task-prompts", () => ({
  generateTaskPrompt: mockGenerateTaskPrompt,
  generateRetryPrompt: mockGenerateRetryPrompt,
}));

// Import after mocking
const { executeAgentWithPrompt, runSingleTask, runRetryTask } = await import(
  "../agent-executor"
);

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

/**
 * Create a mock agent for testing.
 */
function createMockAgent(): BaseAgent {
  return {
    name: "claude",
    buildCommand: mock(() => ({
      command: "claude",
      args: ["--dangerously-skip-permissions"],
      env: {},
    })),
    checkInstalled: mock(() => Promise.resolve(true)),
    getInstallInstructions: mock(() => "Install with: npm install -g claude"),
  } as unknown as BaseAgent;
}

/**
 * Create a mock spec for testing.
 */
function createMockSpec(overrides?: Partial<SpecEntry>): Spec {
  const entry: SpecEntry = {
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
  return Spec.fromEntry(entry);
}

/**
 * Create a mock task for testing.
 */
function createMockTask(overrides?: Partial<TaskEntry>): Task {
  const entry: TaskEntry = {
    id: "task-001",
    description: "Test task",
    status: "in_progress",
    retryCount: 0,
    ...overrides,
  };
  return Task.fromEntry(entry);
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
    agent: createMockAgent(),
    log: mock(noopLog),
    verbose: false,
    ...overrides,
  };
}

describe("Agent Executor", () => {
  beforeEach(() => {
    mockSpawn.mockClear();
    mockSaveSession.mockClear();
    mockGenerateTaskPrompt.mockClear();
    mockGenerateRetryPrompt.mockClear();
    // Reset spawn behavior
    spawnBehavior = {};
  });

  afterEach(() => {
    mockSpawn.mockClear();
    mockSaveSession.mockClear();
    mockGenerateTaskPrompt.mockClear();
    mockGenerateRetryPrompt.mockClear();
  });

  describe("executeAgentWithPrompt()", () => {
    it("returns 'done' when <TASK_DONE> marker is in output", async () => {
      spawnBehavior = {
        stdout: "Working on task...\n<TASK_DONE>\nTask completed successfully.",
        exitCode: 0,
      };

      const ctx = createMockLoopContext();
      const options: ExecuteAgentOptions = {
        prompt: "Test prompt",
      };

      const result = await executeAgentWithPrompt(ctx, options);

      expect(result.status).toBe("done");
      expect(result.output).toContain("<TASK_DONE>");
      expect(result.reason).toBeUndefined();
    });

    it("returns 'blocked' with reason when <TASK_BLOCKED> marker is in output", async () => {
      spawnBehavior = {
        stdout:
          'Cannot proceed.\n<TASK_BLOCKED reason="Missing API key configuration">',
        exitCode: 0,
      };

      const ctx = createMockLoopContext();
      const options: ExecuteAgentOptions = {
        prompt: "Test prompt",
      };

      const result = await executeAgentWithPrompt(ctx, options);

      expect(result.status).toBe("blocked");
      expect(result.reason).toBe("Missing API key configuration");
      expect(result.output).toContain("<TASK_BLOCKED");
    });

    it("returns 'error' when process emits an error", async () => {
      spawnBehavior = {
        error: new Error("Process spawn failed"),
      };

      const ctx = createMockLoopContext();
      const options: ExecuteAgentOptions = {
        prompt: "Test prompt",
      };

      const result = await executeAgentWithPrompt(ctx, options);

      expect(result.status).toBe("error");
      expect(result.reason).toBe("Process spawn failed");
    });

    it("returns 'done' when exit code is 0 without explicit marker", async () => {
      spawnBehavior = {
        stdout: "Completed the work successfully without markers.",
        exitCode: 0,
      };

      const ctx = createMockLoopContext();
      const options: ExecuteAgentOptions = {
        prompt: "Test prompt",
      };

      const result = await executeAgentWithPrompt(ctx, options);

      expect(result.status).toBe("done");
      expect(result.output).toBe(
        "Completed the work successfully without markers."
      );
      expect(result.reason).toBeUndefined();
    });

    it("returns 'error' when exit code is non-zero without markers", async () => {
      spawnBehavior = {
        stdout: "Something went wrong",
        exitCode: 1,
      };

      const ctx = createMockLoopContext();
      const options: ExecuteAgentOptions = {
        prompt: "Test prompt",
      };

      const result = await executeAgentWithPrompt(ctx, options);

      expect(result.status).toBe("error");
      expect(result.reason).toBe("Process exited with code 1");
    });

    it("calls onSpawn callback when provided", async () => {
      spawnBehavior = {
        stdout: "<TASK_DONE>",
        exitCode: 0,
      };

      const ctx = createMockLoopContext();
      const onSpawn = mock(() => {
        // No-op callback for testing
      });
      const options: ExecuteAgentOptions = {
        prompt: "Test prompt",
        onSpawn,
      };

      await executeAgentWithPrompt(ctx, options);

      expect(onSpawn).toHaveBeenCalledTimes(1);
    });

    it("saves session with pid when process spawns", async () => {
      spawnBehavior = {
        stdout: "<TASK_DONE>",
        exitCode: 0,
      };

      const ctx = createMockLoopContext();
      const options: ExecuteAgentOptions = {
        prompt: "Test prompt",
      };

      await executeAgentWithPrompt(ctx, options);

      expect(mockSaveSession).toHaveBeenCalledTimes(1);
      expect(mockSaveSession).toHaveBeenCalledWith(
        ctx.projectPath,
        expect.objectContaining({ pid: 12_345 })
      );
    });
  });

  describe("runSingleTask()", () => {
    it("generates task prompt and executes agent", async () => {
      mockGenerateTaskPrompt.mockImplementation(
        () => "Generated task prompt for single task"
      );
      spawnBehavior = {
        stdout: "Task output\n<TASK_DONE>",
        exitCode: 0,
      };

      const ctx = createMockLoopContext();
      const spec = createMockSpec();
      const task = createMockTask();
      const options: SingleTaskOptions = { spec, task };

      const result = await runSingleTask(ctx, options);

      expect(mockGenerateTaskPrompt).toHaveBeenCalledTimes(1);
      expect(mockGenerateTaskPrompt).toHaveBeenCalledWith(spec, task);
      expect(result.status).toBe("done");
      expect(result.output).toContain("<TASK_DONE>");
    });

    it("passes onSpawn callback through to executeAgentWithPrompt", async () => {
      spawnBehavior = {
        stdout: "<TASK_DONE>",
        exitCode: 0,
      };

      const ctx = createMockLoopContext();
      const spec = createMockSpec();
      const task = createMockTask();
      const onSpawn = mock(() => {
        // No-op callback for testing
      });
      const options: SingleTaskOptions = { spec, task, onSpawn };

      await runSingleTask(ctx, options);

      expect(onSpawn).toHaveBeenCalledTimes(1);
    });
  });

  describe("runRetryTask()", () => {
    it("generates retry prompt with failure context and executes agent", async () => {
      mockGenerateRetryPrompt.mockImplementation(
        () => "Generated retry prompt with failure context"
      );
      spawnBehavior = {
        stdout: "Fixed the issue\n<TASK_DONE>",
        exitCode: 0,
      };

      const ctx = createMockLoopContext();
      const spec = createMockSpec();
      const task = createMockTask({ retryCount: 1 });
      const failedGates = [
        {
          name: "typecheck",
          passed: false,
          output: "Type error at line 42",
          exitCode: 1,
        },
      ];
      const options: RetryOptions = { spec, task, failedGates, retryCount: 1 };

      const result = await runRetryTask(ctx, options);

      expect(mockGenerateRetryPrompt).toHaveBeenCalledTimes(1);
      expect(mockGenerateRetryPrompt).toHaveBeenCalledWith(
        spec,
        task,
        failedGates,
        1
      );
      expect(result.status).toBe("done");
    });

    it("passes onSpawn callback through to executeAgentWithPrompt", async () => {
      spawnBehavior = {
        stdout: "<TASK_DONE>",
        exitCode: 0,
      };

      const ctx = createMockLoopContext();
      const spec = createMockSpec();
      const task = createMockTask();
      const failedGates = [
        { name: "test", passed: false, output: "Test failed", exitCode: 1 },
      ];
      const onSpawn = mock(() => {
        // No-op callback for testing
      });
      const options: RetryOptions = {
        spec,
        task,
        failedGates,
        retryCount: 0,
        onSpawn,
      };

      await runRetryTask(ctx, options);

      expect(onSpawn).toHaveBeenCalledTimes(1);
    });
  });
});
