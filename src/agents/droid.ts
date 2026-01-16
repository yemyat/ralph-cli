import { execSync } from "node:child_process";
import type { AgentCommand } from "../types";
import { type AgentOptions, BaseAgent } from "./base";

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

  checkInstalled(): Promise<boolean> {
    try {
      execSync("which droid", { stdio: "pipe" });
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  getInstallInstructions(): string {
    return `Install Factory Droid:
  curl -fsSL https://app.factory.ai/cli | sh

Then authenticate:
  droid login`;
  }
}
