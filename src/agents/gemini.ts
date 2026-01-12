import { execSync } from "node:child_process";
import type { AgentCommand } from "../types.js";
import { type AgentOptions, BaseAgent } from "./base.js";

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

  checkInstalled(): Promise<boolean> {
    try {
      execSync("which gemini", { stdio: "pipe" });
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
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
