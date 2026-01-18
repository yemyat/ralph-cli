import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

const execAsync = promisify(exec);

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

  async checkInstalled(): Promise<boolean> {
    try {
      await execAsync("which codex");
      return true;
    } catch {
      return false;
    }
  }

  getInstallInstructions(): string {
    return `Install OpenAI Codex CLI:
  npm install -g @openai/codex

Then authenticate:
  codex login`;
  }
}
