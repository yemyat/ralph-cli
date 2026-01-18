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

export interface ResolveContextOptions {
  mode: "plan" | "build";
  agentOverride?: AgentType;
  modelOverride?: string;
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

// Orchestrator types

export interface TaskResult {
  status: "done" | "blocked" | "error";
  reason?: string;
  output: string;
}

// Service types

export interface NotificationContext {
  projectName: string;
  mode: "plan" | "build";
  sessionId: string;
}

export type LogFn = (msg: string) => void;
