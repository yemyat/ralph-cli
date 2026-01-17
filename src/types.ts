export type AgentType =
  | "claude"
  | "amp"
  | "droid"
  | "opencode"
  | "cursor"
  | "codex"
  | "gemini";

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

export interface QualityGate {
  name: string;
  command: string;
  required: boolean;
}

export interface QualityGateResult {
  name: string;
  passed: boolean;
  output: string;
  exitCode: number;
}
