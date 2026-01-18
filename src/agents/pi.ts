import { execSync } from "node:child_process";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

export class PiAgent extends BaseAgent {
  readonly type = "pi" as const;
  readonly name = "Pi";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "--print", // print mode (non-interactive)
      "--mode",
      "json", // structured JSON output
      "--thinking",
      "high", // high thinking mode
    ];

    if (options.model) {
      args.push("--model", options.model);
    }

    if (options.provider) {
      args.push("--provider", options.provider);
    }

    return {
      command: "pi",
      args,
    };
  }

  checkInstalled(): Promise<boolean> {
    try {
      execSync("which pi", { stdio: "pipe" });
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  getInstallInstructions(): string {
    return `Install Pi:
  bun install -g @anthropic-ai/pi
  # or
  npm install -g @anthropic-ai/pi`;
  }
}
