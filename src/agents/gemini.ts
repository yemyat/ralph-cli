import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

const execAsync = promisify(exec);

export class GeminiAgent extends BaseAgent {
  readonly type = "gemini" as const;
  readonly name = "Gemini CLI";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "--output-format",
      "stream-json", // streaming JSON output
      "--yolo", // auto-approve all actions
    ];

    if (options.model) {
      args.push("--model", options.model);
    }

    return {
      command: "gemini",
      args,
    };
  }

  async checkInstalled(): Promise<boolean> {
    try {
      await execAsync("which gemini");
      return true;
    } catch {
      return false;
    }
  }

  getInstallInstructions(): string {
    return `Install Gemini CLI:
  npm install -g @anthropic-ai/gemini-cli
  # or
  brew install gemini-cli

Then authenticate:
  gemini auth login`;
  }
}
