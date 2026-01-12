import { execSync } from "child_process";
import type { AgentCommand } from "../types.js";
import { BaseAgent, type AgentOptions } from "./base.js";

export class DroidAgent extends BaseAgent {
  readonly type = "droid" as const;
  readonly name = "Factory Droid";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "exec", // non-interactive execution
      "--skip-permissions-unsafe", // auto-approve (equivalent to dangerously-skip-permissions)
      "--auto", "high", // high autonomy for full automation
      "-o", "stream-json", // structured output
    ];

    if (options.model) {
      args.push("-m", options.model);
    }

    return {
      command: "droid",
      args,
    };
  }

  async checkInstalled(): Promise<boolean> {
    try {
      execSync("which droid", { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  getInstallInstructions(): string {
    return `Install Factory Droid:
  curl -fsSL https://app.factory.ai/cli | sh

Then authenticate:
  droid login`;
  }
}
