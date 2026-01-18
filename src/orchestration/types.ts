/**
 * Orchestration types.
 * Shared interfaces for the orchestration module.
 */

import type { spawn } from "node:child_process";
import type { BaseAgent } from "../agents/base";
import type { Spec, Task } from "../domain";
import type { QualityGateResult, RalphConfig, RalphSession } from "../types";

/**
 * Core context object for loop operations.
 * Contains the essential dependencies needed throughout the orchestration flow.
 */
export interface LoopContext {
  /** Path to the project root directory */
  projectPath: string;
  /** Ralph configuration */
  config: RalphConfig;
  /** Current session state */
  session: RalphSession;
  /** Agent instance for executing tasks */
  agent: BaseAgent;
  /** Logger function */
  log: (msg: string) => void;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Options for executing an agent with a prompt.
 */
export interface ExecuteAgentOptions {
  /** The prompt to send to the agent */
  prompt: string;
  /** Callback invoked when the child process is spawned */
  onSpawn?: (child: ReturnType<typeof spawn>) => void;
}

/**
 * Options for retrying a failed task.
 */
export interface RetryOptions {
  /** The spec containing the task */
  spec: Spec;
  /** The task that failed */
  task: Task;
  /** Quality gates that failed */
  failedGates: QualityGateResult[];
  /** Number of retry attempts made */
  retryCount: number;
  /** Callback invoked when the child process is spawned */
  onSpawn?: (child: ReturnType<typeof spawn>) => void;
}

/**
 * Options for running a single task.
 */
export interface SingleTaskOptions {
  /** The spec containing the task */
  spec: Spec;
  /** The task to execute */
  task: Task;
  /** Callback invoked when the child process is spawned */
  onSpawn?: (child: ReturnType<typeof spawn>) => void;
}

/**
 * Options for handling failed quality gates.
 */
export interface GatesFailedOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Callback to run retry task */
  runRetryTask?: (
    spec: Spec,
    task: Task,
    failedGates: QualityGateResult[],
    retryCount: number
  ) => Promise<void>;
}

/**
 * Task context containing spec and task info.
 * Used by task handlers to avoid passing multiple parameters.
 */
export interface TaskContext {
  /** The spec containing the task */
  spec: Spec;
  /** The task being processed */
  task: Task;
}

/**
 * Options for handling a blocked task.
 */
export interface BlockedTaskOptions extends TaskContext {
  /** Reason the task was blocked */
  reason: string | undefined;
}

/**
 * Options for handling done task result.
 */
export interface DoneResultOptions extends TaskContext {
  /** Options for gates failed scenario */
  gatesFailedOptions: GatesFailedOptions;
}

/**
 * Options for running the task-level loop.
 */
export interface TaskLevelLoopOptions {
  /** Path to the project root directory */
  projectPath: string;
  /** Ralph configuration */
  config: RalphConfig;
  /** Current session state */
  session: RalphSession;
  /** Path to the log file */
  logFile: string;
  /** Agent instance for executing tasks */
  agent: BaseAgent;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Enable verbose output */
  verbose?: boolean;
}
