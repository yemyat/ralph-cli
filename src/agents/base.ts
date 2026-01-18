import type { AgentCommand, AgentOptions, AgentType } from "../types";

export abstract class BaseAgent {
  abstract readonly type: AgentType;
  abstract readonly name: string;

  abstract buildCommand(options: AgentOptions): AgentCommand;

  abstract checkInstalled(): Promise<boolean>;

  abstract getInstallInstructions(): string;
}
