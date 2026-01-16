import { execSync } from "node:child_process";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

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

  checkInstalled(): Promise<boolean> {
    try {
      execSync("which agent", { stdio: "pipe" });
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  getInstallInstructions(): string {
    return `Install Cursor Agent CLI:
  curl https://cursor.com/install -fsS | bash

Requires Cursor subscription for full access.`;
  }
}
