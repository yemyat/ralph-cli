import { execSync } from "node:child_process";
import type { AgentCommand } from "../types.js";
import { type AgentOptions, BaseAgent } from "./base.js";

export class AmpAgent extends BaseAgent {
  readonly type = "amp" as const;
  readonly name = "Amp Code";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "--dangerously-allow-all",
      "--execute", // non-interactive execution
      "--stream-json", // structured output
    ];

    // Amp uses modes instead of model names
    // smart = state-of-the-art models, rush = faster/cheaper
    if (options.model === "rush" || options.model === "smart") {
      args.push("--mode", options.model);
    }

    return {
      command: "amp",
      args,
    };
  }

  checkInstalled(): Promise<boolean> {
    try {
      execSync("which amp", { stdio: "pipe" });
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  getInstallInstructions(): string {
    return `Install Amp:
  curl -fsSL https://ampcode.com/install.sh | bash

Or via npm:
  npm install -g @sourcegraph/amp

Then sign in at https://ampcode.com/install`;
  }
}
