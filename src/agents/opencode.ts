import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

const execAsync = promisify(exec);

export class OpenCodeAgent extends BaseAgent {
  readonly type = "opencode" as const;
  readonly name = "OpenCode";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "run",
      "--format",
      "json", // structured JSON output
    ];

    if (options.model) {
      args.push("--model", options.model);
    }

    return {
      command: "opencode",
      args,
    };
  }

  async checkInstalled(): Promise<boolean> {
    try {
      await execAsync("which opencode");
      return true;
    } catch {
      return false;
    }
  }

  getInstallInstructions(): string {
    return `Install OpenCode:
  npm install -g opencode
  # or
  curl -fsSL https://opencode.ai/install | sh

Then authenticate:
  opencode auth login`;
  }
}
