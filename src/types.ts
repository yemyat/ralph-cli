export type AgentType =
  | "claude"
  | "amp"
  | "droid"
  | "opencode"
  | "cursor"
  | "codex"
  | "gemini";

export interface RalphConfig {
  projectName: string;
  agent: AgentType;
  model?: string;
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
