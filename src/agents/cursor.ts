import { execSync } from "node:child_process";
import type { AgentCommand } from "../types.js";
import { type AgentOptions, BaseAgent } from "./base.js";

export class CursorAgent extends BaseAgent {
  readonly type = "cursor" as const;
  readonly name = "Cursor Agent";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "-p", // print mode (non-interactive)
      "--output-format",
      "json", // structured JSON output
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
