/**
 * Agent execution logic.
 * Spawn agent processes and parse results.
 */

import { spawn } from "node:child_process";
import { saveSession } from "../config";
import type { QualityGateResult, SpecEntry, TaskEntry } from "../types";
import { generateRetryPrompt, generateTaskPrompt } from "../utils/task-prompts";
import type { ExecuteAgentOptions, LoopContext } from "./types";

const TASK_BLOCKED_REGEX = /<TASK_BLOCKED\s+reason="([^"]+)">/;

export interface TaskResult {
  status: "done" | "blocked" | "error";
  reason?: string;
  output: string;
}

/**
 * Execute agent with a given prompt and parse result.
 */
export function executeAgentWithPrompt(
  context: LoopContext,
  options: ExecuteAgentOptions
): Promise<TaskResult> {
  const { projectPath, agent, session, log, verbose } = context;
  const { prompt, onSpawn } = options;

  const cmdOptions = agent.buildCommand({
    model: session.model,
    verbose,
  });

  return new Promise((resolve) => {
    let stdoutBuffer = "";

    const child = spawn(cmdOptions.command, cmdOptions.args, {
      cwd: projectPath,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...cmdOptions.env },
    });

    onSpawn?.(child);
    session.pid = child.pid;
    saveSession(projectPath, session);

    child.stdin?.write(prompt);
    child.stdin?.end();

    child.stdout?.on("data", (data) => {
      const output = data.toString();
      log(`[stdout] ${output}`);
      if (verbose) {
        process.stdout.write(output);
      }
      stdoutBuffer += output;
    });

    child.stderr?.on("data", (data) => {
      const output = data.toString();
      log(`[stderr] ${output}`);
      if (verbose) {
        process.stderr.write(output);
      }
    });

    child.on("error", (err) => {
      log(`Error: ${err.message}`);
      resolve({ status: "error", output: stdoutBuffer, reason: err.message });
    });

    child.on("close", (code) => {
      log(`Agent exited with code ${code}`);

      // Check for task markers
      if (stdoutBuffer.includes("<TASK_DONE>")) {
        log("Detected TASK_DONE marker");
        resolve({ status: "done", output: stdoutBuffer });
        return;
      }

      const blockedMatch = stdoutBuffer.match(TASK_BLOCKED_REGEX);
      if (blockedMatch) {
        log(`Detected TASK_BLOCKED marker: ${blockedMatch[1]}`);
        resolve({
          status: "blocked",
          output: stdoutBuffer,
          reason: blockedMatch[1],
        });
        return;
      }

      // No explicit marker - treat as done if exit code is 0
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

/**
 * Run a single task with the agent.
 */
export function runSingleTask(
  context: LoopContext,
  spec: SpecEntry,
  task: TaskEntry,
  onSpawn?: (child: ReturnType<typeof spawn>) => void
): Promise<TaskResult> {
  const taskPrompt = generateTaskPrompt(spec, task);
  return executeAgentWithPrompt(context, { prompt: taskPrompt, onSpawn });
}

/**
 * Run a retry task with failure context.
 */
export function runRetryTask(
  context: LoopContext,
  spec: SpecEntry,
  task: TaskEntry,
  failedGates: QualityGateResult[],
  retryCount: number,
  onSpawn?: (child: ReturnType<typeof spawn>) => void
): Promise<TaskResult> {
  const retryPrompt = generateRetryPrompt(spec, task, failedGates, retryCount);
  return executeAgentWithPrompt(context, { prompt: retryPrompt, onSpawn });
}
