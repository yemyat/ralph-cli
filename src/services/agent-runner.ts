import { spawn } from "node:child_process";
import type { BaseAgent } from "../agents/base";
import { MARKERS } from "../constants";
import type { AgentRunnerOptions, RunOptions, TaskResult } from "../types";

const TASK_BLOCKED_REGEX = /<TASK_BLOCKED\s+reason="([^"]+)">/;

export class AgentRunner {
  private readonly agent: BaseAgent;
  private readonly model?: string;
  private readonly verbose: boolean;
  private readonly log: (msg: string) => void;

  constructor(options: AgentRunnerOptions) {
    this.agent = options.agent;
    this.model = options.model;
    this.verbose = options.verbose ?? false;
    this.log = options.log;
  }

  run(options: RunOptions): Promise<TaskResult> {
    const { prompt, onSpawn } = options;
    const cmdOptions = this.agent.buildCommand({
      model: this.model,
      verbose: this.verbose,
    });

    return new Promise((resolve) => {
      let stdoutBuffer = "";

      const child = spawn(cmdOptions.command, cmdOptions.args, {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...cmdOptions.env },
      });

      onSpawn?.(child);

      child.stdin?.write(prompt);
      child.stdin?.end();

      child.stdout?.on("data", (data) => {
        const output = data.toString();
        this.log(`[stdout] ${output}`);
        if (this.verbose) {
          process.stdout.write(output);
        }
        stdoutBuffer += output;
      });

      child.stderr?.on("data", (data) => {
        const output = data.toString();
        this.log(`[stderr] ${output}`);
        if (this.verbose) {
          process.stderr.write(output);
        }
      });

      child.on("error", (err) => {
        this.log(`Error: ${err.message}`);
        resolve({ status: "error", output: stdoutBuffer, reason: err.message });
      });

      child.on("close", (code) => {
        this.log(`Agent exited with code ${code}`);

        if (stdoutBuffer.includes(MARKERS.TASK_DONE)) {
          this.log("Detected TASK_DONE marker");
          resolve({ status: "done", output: stdoutBuffer });
          return;
        }

        const blockedMatch = stdoutBuffer.match(TASK_BLOCKED_REGEX);
        if (blockedMatch) {
          this.log(`Detected TASK_BLOCKED marker: ${blockedMatch[1]}`);
          resolve({
            status: "blocked",
            output: stdoutBuffer,
            reason: blockedMatch[1],
          });
          return;
        }

        if (code === 0) {
          resolve({ status: "done", output: stdoutBuffer });
        } else {
          resolve({
            status: "error",
            output: stdoutBuffer,
            reason: `Process exited with code ${code}`,
          });
        }
      });
    });
  }
}
