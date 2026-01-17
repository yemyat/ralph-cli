import type { AgentCommand, AgentType } from "../types";

export interface AgentOptions {
  model?: string;
  promptFile?: string;
  verbose?: boolean;
}

export abstract class BaseAgent {
  abstract readonly type: AgentType;
  abstract readonly name: string;

  abstract buildCommand(options: AgentOptions): AgentCommand;

  abstract checkInstalled(): Promise<boolean>;

  abstract getInstallInstructions(): string;
}
