import type { ChildProcess } from "node:child_process";
import type { BaseAgent } from "./agents/base";

export type AgentType =
  | "claude"
  | "amp"
  | "droid"
  | "opencode"
  | "cursor"
  | "codex"
  | "gemini"
  | "pi";

export interface AgentConfig {
  agent: AgentType;
  model?: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface NotificationsConfig {
  telegram?: TelegramConfig;
}

export interface RalphConfig {
  projectName: string;
  /** @deprecated Use agents.plan and agents.build instead */
  agent?: AgentType;
  /** @deprecated Use agents.plan.model and agents.build.model instead */
  model?: string;
  agents: {
    plan: AgentConfig;
    build: AgentConfig;
  };
  notifications?: NotificationsConfig;
  maxIterations?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RalphSession {
  id: string;
  mode: "plan" | "build";
  status: "running" | "paused" | "stopped" | "completed";
  pid?: number;
  iteration: number;
  startedAt: string;
  pausedAt?: string;
  stoppedAt?: string;
  agent: AgentType;
  model?: string;
}

export interface ProjectState {
  config: RalphConfig;
  sessions: RalphSession[];
}

export interface AgentCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Task-level orchestration types

export type TaskStatusType =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked"
  | "failed";

export interface TaskEntry {
  id: string;
  description: string;
  status: TaskStatusType;
  acceptanceCriteria?: string[];
  blockedReason?: string;
  retryCount?: number;
  completedAt?: string;
}

export interface SpecEntry {
  id: string;
  file: string;
  name: string;
  priority: number;
  status: TaskStatusType;
  context?: string;
  tasks: TaskEntry[];
  acceptanceCriteria?: string[];
}

export interface Implementation {
  version: number;
  updatedAt: string;
  updatedBy: "plan-mode" | "build-mode" | "user";
  specs: SpecEntry[];
}

// Agent options

export interface AgentOptions {
  model?: string;
  promptFile?: string;
  verbose?: boolean;
  provider?: string;
}

// Command options

export interface InitOptions {
  agent?: AgentType;
  model?: string;
  planAgent?: AgentType;
  planModel?: string;
  buildAgent?: AgentType;
  buildModel?: string;
  force?: boolean;
}

export interface PlanOptions {
  agent?: AgentType;
  model?: string;
  verbose?: boolean;
}

export interface BuildOptions {
  agent?: AgentType;
  model?: string;
  verbose?: boolean;
}

export interface InitProjectOptions {
  planAgent: AgentType;
  planModel?: string;
  buildAgent: AgentType;
  buildModel?: string;
  notifications?: NotificationsConfig;
}

// Task prompt interfaces

export interface TaskLike {
  readonly description: string;
  readonly status: TaskStatusType;
  readonly acceptanceCriteria?: readonly string[];
  readonly blockedReason?: string;
}

export interface SpecLike {
  readonly name: string;
  readonly file: string;
  readonly context?: string;
  readonly tasks: readonly TaskLike[];
}

// Notification types

export type NotificationStatus =
  | "loop_started"
  | "iteration_success"
  | "iteration_failure"
  | "loop_completed"
  | "loop_stopped";

export interface NotificationPayload {
  projectName: string;
  mode: "plan" | "build";
  sessionId: string;
  iteration: number;
  status: NotificationStatus;
  workingDirectory?: string;
  branch?: string;
  taskDescription?: string;
}

// Hook system types

export interface HookPayload {
  projectName: string;
  mode: "plan" | "build";
  sessionId: string;
  iteration: number;
  agent: string;
  model?: string;
  taskDescription?: string;
  specName?: string;
  logFile?: string;
  promptFile?: string;
}

export interface HookListener {
  onLoopStarted?(payload: HookPayload): void | Promise<void>;
  onIterationStarted?(payload: HookPayload): void | Promise<void>;
  onIterationSuccess?(payload: HookPayload): void | Promise<void>;
  onIterationFailure?(payload: HookPayload): void | Promise<void>;
  onTaskBlocked?(payload: HookPayload): void | Promise<void>;
  onSpecCompleted?(payload: HookPayload): void | Promise<void>;
  onLoopCompleted?(payload: HookPayload): void | Promise<void>;
  onLoopStopped?(payload: HookPayload): void | Promise<void>;
}

// Service result types

export interface TaskResult {
  status: "done" | "blocked" | "error";
  reason?: string;
  output: string;
}

// Service types

import type { LoggerService } from "./services/logger-service";

export interface AgentRunnerOptions {
  agent: BaseAgent;
  model?: string;
  verbose?: boolean;
  logger?: LoggerService | null;
}

export interface RunOptions {
  prompt: string;
  onSpawn?: (child: ChildProcess) => void;
}

export interface TelegramListenerOptions {
  config: TelegramConfig | undefined;
  onError?: (err: unknown) => void;
}
