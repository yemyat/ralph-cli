import { execSync } from "node:child_process";
import type { AgentCommand } from "../types.js";
import { type AgentOptions, BaseAgent } from "./base.js";

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

  checkInstalled(): Promise<boolean> {
    try {
      execSync("which opencode", { stdio: "pipe" });
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
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
