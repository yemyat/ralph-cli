import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

const execAsync = promisify(exec);

export class CursorAgent extends BaseAgent {
  readonly type = "cursor" as const;
  readonly name = "Cursor Agent";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "-p", // print mode (non-interactive)
      "--output-format",
      "stream-json", // structured JSON output
      "-f", // force allow commands unless explicitly denied
      "--approve-mcps", // auto-approve MCP servers
    ];

    if (options.model) {
      args.push("--model", options.model);
    }

    return {
      command: "agent",
      args,
    };
  }

  async checkInstalled(): Promise<boolean> {
    try {
      await execAsync("which agent");
      return true;
    } catch {
      return false;
    }
  }

  getInstallInstructions(): string {
    return `Install Cursor Agent CLI:
  curl https://cursor.com/install -fsS | bash

Requires Cursor subscription for full access.`;
  }
}
