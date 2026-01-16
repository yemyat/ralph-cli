import { execSync } from "node:child_process";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

export class CodexAgent extends BaseAgent {
  readonly type = "codex" as const;
  readonly name = "OpenAI Codex";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "exec",
      "--json", // structured JSON output
      "--dangerously-bypass-approvals-and-sandbox", // auto-approve all tool calls
    ];

    if (options.model) {
      args.push("--model", options.model);
    }

    return {
      command: "codex",
      args,
    };
  }

  checkInstalled(): Promise<boolean> {
    try {
      execSync("which codex", { stdio: "pipe" });
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  getInstallInstructions(): string {
    return `Install OpenAI Codex CLI:
  npm install -g @openai/codex

Then authenticate:
  codex login`;
  }
}
