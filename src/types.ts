export type AgentType =
  | "claude"
  | "amp"
  | "droid"
  | "opencode"
  | "cursor"
  | "codex"
  | "gemini";

export interface RalphConfig {
  projectId: string;
  projectPath: string;
  projectName: string;
  agent: AgentType;
  model?: string;
  maxIterations?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RalphSession {
  id: string;
  projectId: string;
  mode: "plan" | "build";
  status: "running" | "paused" | "stopped" | "completed";
  pid?: number;
  iteration: number;
  startedAt: string;
  pausedAt?: string;
  stoppedAt?: string;
  agent: AgentType;
  model?: string;
  logFile: string;
}

export interface GlobalConfig {
  defaultAgent: AgentType;
  defaultModel?: string;
  projects: Record<string, RalphConfig>;
  sessions: Record<string, RalphSession>;
}

export interface AgentCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
}
