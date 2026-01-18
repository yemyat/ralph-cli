/**
 * Orchestration types.
 * Shared interfaces for the orchestration module.
 */

import type { spawn } from "node:child_process";
import type { BaseAgent } from "../agents/base";
import type {
  QualityGateResult,
  RalphConfig,
  RalphSession,
  SpecEntry,
  TaskEntry,
} from "../types";

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
  spec: SpecEntry;
  /** The task that failed */
  task: TaskEntry;
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
  spec: SpecEntry;
  /** The task to execute */
  task: TaskEntry;
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
    spec: SpecEntry,
    task: TaskEntry,
    failedGates: QualityGateResult[],
    retryCount: number
  ) => Promise<void>;
}
