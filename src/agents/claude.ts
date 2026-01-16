import { execSync } from "node:child_process";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

export class ClaudeAgent extends BaseAgent {
  readonly type = "claude" as const;
  readonly name = "Claude Code";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "-p", // print mode (non-interactive)
      "--dangerously-skip-permissions", // auto-approve all tool calls
      "--output-format=stream-json", // structured output
    ];

    if (options.model) {
      args.push("--model", options.model);
    }

    if (options.verbose) {
      args.push("--verbose");
    }

    return {
      command: "claude",
      args,
    };
  }

  checkInstalled(): Promise<boolean> {
    try {
      execSync("which claude", { stdio: "pipe" });
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  getInstallInstructions(): string {
    return `Install Claude Code:
  npm install -g @anthropic-ai/claude-code

Then authenticate:
  claude login`;
  }
}
