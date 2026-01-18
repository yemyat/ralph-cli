/**
 * Test fixtures for orchestration module.
 * Provides reusable mock helpers for test doubles.
 */

import { mock } from "bun:test";
import type { BaseAgent } from "../../agents/base";
import type {
  AgentCommand,
  Implementation,
  RalphConfig,
  RalphSession,
  SpecEntry,
  TaskEntry,
} from "../../types";
import type { LoopContext } from "../types";

/**
 * Create a mock spec entry for testing.
 */
export function createMockSpec(overrides?: Partial<SpecEntry>): SpecEntry {
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
export function createMockTask(overrides?: Partial<TaskEntry>): TaskEntry {
  return {
    id: "task-001",
    description: "Test task",
    status: "in_progress",
    retryCount: 0,
    ...overrides,
  };
}

/**
 * Create a mock config for testing.
 */
export function createMockConfig(
  overrides?: Partial<RalphConfig>
): RalphConfig {
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
export function createMockSession(
  overrides?: Partial<RalphSession>
): RalphSession {
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
 * No-op log function for tests.
 */
function noopLog(_msg: string): void {
  // Intentionally empty - used to suppress console output in tests
}

/**
 * Create a mock executor (agent) for testing.
 * Returns a BaseAgent-compatible mock with configurable behavior.
 */
export function createMockExecutor(
  commandOverrides?: Partial<AgentCommand>
): BaseAgent {
  const defaultCommand: AgentCommand = {
    command: "claude",
    args: ["--dangerously-skip-permissions"],
    env: {},
    ...commandOverrides,
  };

  return {
    type: "claude",
    name: "claude",
    buildCommand: mock(() => defaultCommand),
    checkInstalled: mock(() => Promise.resolve(true)),
    getInstallInstructions: mock(() => "Install with: npm install -g claude"),
  } as unknown as BaseAgent;
}

/**
 * Create a mock implementation for testing.
 * This represents the implementation.json structure with specs and tasks.
 */
export function createMockImplementation(
  specs?: SpecEntry[],
  overrides?: Partial<Implementation>
): Implementation {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "build-mode",
    specs: specs ?? [createMockSpec()],
    qualityGates: ["bun run typecheck", "bun run test"],
    ...overrides,
  };
}

/**
 * Create a mock loop context for testing.
 * This is the core context object used throughout orchestration.
 */
export function createMockContext(
  overrides?: Partial<LoopContext>
): LoopContext {
  return {
    projectPath: "/tmp/test-project",
    config: createMockConfig(),
    session: createMockSession(),
    agent: createMockExecutor(),
    log: mock(noopLog),
    verbose: false,
    ...overrides,
  };
}

/**
 * Create a mock quality gate result for testing.
 */
export function createMockQualityGateResult(overrides?: {
  name?: string;
  passed?: boolean;
  output?: string;
  exitCode?: number;
}) {
  return {
    name: overrides?.name ?? "typecheck",
    passed: overrides?.passed ?? true,
    output: overrides?.output ?? "",
    exitCode: overrides?.exitCode ?? 0,
  };
}
