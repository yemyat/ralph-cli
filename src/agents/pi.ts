import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentCommand, AgentOptions } from "../types";
import { BaseAgent } from "./base";

const execAsync = promisify(exec);

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

  async checkInstalled(): Promise<boolean> {
    try {
      await execAsync("which pi");
      return true;
    } catch {
      return false;
    }
  }

  getInstallInstructions(): string {
    return `Install Pi:
  bun install -g @anthropic-ai/pi
  # or
  npm install -g @anthropic-ai/pi`;
  }
}
