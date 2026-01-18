import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

const execAsync = promisify(exec);

export class DroidAgent extends BaseAgent {
  readonly type = "droid" as const;
  readonly name = "Factory Droid";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = [
      "exec", // non-interactive execution
      "--skip-permissions-unsafe", // highest and the most dangerous autonomy
      "-o",
      "stream-json", // structured output
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
      await execAsync("which droid");
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
