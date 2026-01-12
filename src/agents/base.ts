import type { AgentCommand, AgentType } from "../types.js";

export interface AgentOptions {
  model?: string;
  promptFile: string;
  verbose?: boolean;
}

export abstract class BaseAgent {
  abstract readonly type: AgentType;
  abstract readonly name: string;

  abstract buildCommand(options: AgentOptions): AgentCommand;

  abstract checkInstalled(): Promise<boolean>;

  abstract getInstallInstructions(): string;
}
