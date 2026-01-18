/**
 * Task-level orchestration loop.
 * Main entry point for running the build loop.
 */

import { spawn } from "node:child_process";
import fse from "fs-extra";
import pc from "picocolors";
import type { getAgent } from "../agents/index";
import { saveSession } from "../config";
import type {
  Implementation,
  QualityGateResult,
  RalphConfig,
  RalphSession,
  SpecEntry,
  TaskEntry,
} from "../types";
import {
  getNextPendingTask,
  markTaskBlocked,
  markTaskCompleted,
  markTaskFailed,
  markTaskInProgress,
  parseImplementation,
  resetTaskToPending,
  saveImplementation,
} from "../utils/implementation";
import {
  getFailedGates,
  parseQualityGates,
  runQualityGates,
} from "../utils/quality-gates";
import { generateRetryPrompt, generateTaskPrompt } from "../utils/task-prompts";
import {
  type NotificationPayload,
  type NotificationStatus,
  sendTelegramNotification,
} from "../utils/telegram";

const TASK_BLOCKED_REGEX = /<TASK_BLOCKED\s+reason="([^"]+)">/;

export interface TaskLoopOptions {
  maxRetries?: number;
  verbose?: boolean;
}

interface TaskLoopContext {
  projectPath: string;
  config: RalphConfig;
  session: RalphSession;
  agentInstance: ReturnType<typeof getAgent>;
  maxRetries: number;
  verbose?: boolean;
  log: (msg: string) => void;
  setCurrentChild: (child: ReturnType<typeof spawn>) => void;
}

interface TaskResult {
  status: "done" | "blocked" | "error";
  reason?: string;
  output: string;
}

function getGitBranch(): string | undefined {
  try {
    const { execSync } = require("node:child_process");
    return execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Send a Telegram notification if configured.
 * Failures are logged but don't crash the loop.
 */
async function notifyTelegram(
  config: RalphConfig,
  session: RalphSession,
  status: NotificationStatus,
  log: (msg: string) => void,
  taskDescription?: string
): Promise<void> {
  const telegramConfig = config.notifications?.telegram;
  if (!telegramConfig?.enabled) {
    return;
  }

  const payload: NotificationPayload = {
    projectName: config.projectName,
    mode: session.mode,
    sessionId: session.id,
    iteration: session.iteration,
    status,
    workingDirectory: process.cwd(),
    branch: getGitBranch(),
    taskDescription,
  };

  const success = await sendTelegramNotification(telegramConfig, payload);
  if (success) {
    log(`Telegram notification sent: ${status}`);
  } else {
    log(`Telegram notification failed: ${status}`);
  }
}

/**
 * Handle a blocked task result.
 */
async function handleBlockedTask(
  impl: Implementation,
  spec: SpecEntry,
  task: TaskEntry,
  reason: string | undefined,
  ctx: TaskLoopContext
): Promise<void> {
  console.log(pc.yellow(`  ⚠ Task blocked: ${reason}`));
  ctx.log(`Task blocked: ${reason}`);
  markTaskBlocked(impl, spec.id, task.id, reason || "Unknown");
  await saveImplementation(ctx.projectPath, impl);
}

/**
 * Handle quality gates passed.
 */
async function handleGatesPassed(
  impl: Implementation,
  spec: SpecEntry,
  task: TaskEntry,
  ctx: TaskLoopContext
): Promise<void> {
  console.log(pc.green("  ✓ All quality gates passed"));
  ctx.log("All quality gates passed");
  markTaskCompleted(impl, spec.id, task.id);
  await saveImplementation(ctx.projectPath, impl);
  await notifyTelegram(
    ctx.config,
    ctx.session,
    "iteration_success",
    ctx.log,
    task.description
  );

  // Check if spec is complete
  const updatedSpec = impl.specs.find((s) => s.id === spec.id);
  if (updatedSpec?.status === "completed") {
    console.log(pc.green(`\n✓ Spec completed: ${spec.name}`));
    ctx.log(`Spec completed: ${spec.name}`);
  }
}

/**
 * Handle quality gates failed.
 */
async function handleGatesFailed(
  impl: Implementation,
  spec: SpecEntry,
  task: TaskEntry,
  failedGates: QualityGateResult[],
  ctx: TaskLoopContext
): Promise<void> {
  const retryCount = task.retryCount || 0;

  if (retryCount < ctx.maxRetries) {
    console.log(
      pc.yellow(
        `  ⚠ Quality gates failed (retry ${retryCount + 1}/${ctx.maxRetries})`
      )
    );
    ctx.log(
      `Quality gates failed, retrying (${retryCount + 1}/${ctx.maxRetries})`
    );

    markTaskFailed(impl, spec.id, task.id);
    resetTaskToPending(impl, spec.id, task.id);
    await saveImplementation(ctx.projectPath, impl);

    await runRetryTask(
      ctx.projectPath,
      spec,
      task,
      failedGates,
      retryCount,
      ctx.agentInstance,
      ctx.session,
      ctx.log,
      ctx.verbose,
      ctx.setCurrentChild
    );
  } else {
    console.log(pc.red("  ✗ Max retries exceeded for task"));
    ctx.log(`Max retries exceeded for task ${task.id}`);
    markTaskFailed(impl, spec.id, task.id);
    await saveImplementation(ctx.projectPath, impl);
    await notifyTelegram(
      ctx.config,
      ctx.session,
      "iteration_failure",
      ctx.log,
      task.description
    );
  }
}

/**
 * Handle task error.
 */
async function handleTaskError(
  impl: Implementation,
  spec: SpecEntry,
  task: TaskEntry,
  ctx: TaskLoopContext
): Promise<void> {
  console.log(pc.red("  ✗ Task failed"));
  ctx.log(`Task failed: ${task.id}`);
  markTaskFailed(impl, spec.id, task.id);
  await saveImplementation(ctx.projectPath, impl);
  await notifyTelegram(
    ctx.config,
    ctx.session,
    "iteration_failure",
    ctx.log,
    task.description
  );
}

/**
 * Handle a done task result - run quality gates.
 * If qualityGates is not defined in implementation.json, skip verification.
 */
async function handleDoneResult(
  impl: Implementation,
  spec: SpecEntry,
  task: TaskEntry,
  projectPath: string,
  ctx: TaskLoopContext
): Promise<void> {
  // Skip quality gate verification if not defined or empty
  const qualityGateCommands = impl.qualityGates;
  if (!qualityGateCommands || qualityGateCommands.length === 0) {
    console.log(pc.gray("\n  Skipping quality gates (not configured)"));
    ctx.log("Quality gates skipped - not configured in implementation.json");
    await handleGatesPassed(impl, spec, task, ctx);
    return;
  }

  console.log(pc.gray("\n  Running quality gates..."));
  ctx.log("Running quality gates");

  const gates = parseQualityGates(qualityGateCommands);
  const gateResults = await runQualityGates(gates, projectPath, {
    onGateStart: (gate) => console.log(pc.gray(`    ⏳ ${gate.name}...`)),
    onGateComplete: (r) => {
      const icon = r.passed ? pc.green("✓") : pc.red("✗");
      console.log(`    ${icon} ${r.name}`);
    },
  });

  const failedGates = getFailedGates(gateResults);

  if (failedGates.length === 0) {
    await handleGatesPassed(impl, spec, task, ctx);
  } else {
    await handleGatesFailed(impl, spec, task, failedGates, ctx);
  }
}

/**
 * Run a single task with the agent.
 */
function runSingleTask(
  projectPath: string,
  spec: SpecEntry,
  task: TaskEntry,
  agentInstance: ReturnType<typeof getAgent>,
  session: RalphSession,
  log: (msg: string) => void,
  verbose?: boolean,
  onSpawn?: (child: ReturnType<typeof spawn>) => void
): Promise<TaskResult> {
  const taskPrompt = generateTaskPrompt(spec, task);
  return executeAgentWithPrompt(
    projectPath,
    taskPrompt,
    agentInstance,
    session,
    log,
    verbose,
    onSpawn
  );
}

/**
 * Run a retry task with failure context.
 */
function runRetryTask(
  projectPath: string,
  spec: SpecEntry,
  task: TaskEntry,
  failedGates: QualityGateResult[],
  retryCount: number,
  agentInstance: ReturnType<typeof getAgent>,
  session: RalphSession,
  log: (msg: string) => void,
  verbose?: boolean,
  onSpawn?: (child: ReturnType<typeof spawn>) => void
): Promise<TaskResult> {
  const retryPrompt = generateRetryPrompt(spec, task, failedGates, retryCount);
  return executeAgentWithPrompt(
    projectPath,
    retryPrompt,
    agentInstance,
    session,
    log,
    verbose,
    onSpawn
  );
}

/**
 * Execute agent with a given prompt and parse result.
 */
function executeAgentWithPrompt(
  projectPath: string,
  prompt: string,
  agentInstance: ReturnType<typeof getAgent>,
  session: RalphSession,
  log: (msg: string) => void,
  verbose?: boolean,
  onSpawn?: (child: ReturnType<typeof spawn>) => void
): Promise<TaskResult> {
  const cmdOptions = agentInstance.buildCommand({
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
 * Run the task-level build loop.
 * Processes one task at a time with external quality gates.
 */
export async function runTaskLevelLoop(
  projectPath: string,
  config: RalphConfig,
  session: RalphSession,
  logFile: string,
  agentInstance: ReturnType<typeof getAgent>,
  options: TaskLoopOptions = {}
): Promise<void> {
  const { maxRetries = 3, verbose } = options;
  const logStream = fse.createWriteStream(logFile, { flags: "a" });
  let currentChild: ReturnType<typeof spawn> | null = null;

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${msg}\n`);
    if (verbose) {
      console.log(pc.gray(`[${timestamp}]`), msg);
    }
  };

  log(`Starting task-level loop - Session ${session.id}`);
  await notifyTelegram(config, session, "loop_started", log);

  const handleSignal = async () => {
    console.log(pc.yellow("\n\nStopping Ralph loop..."));
    if (currentChild && !currentChild.killed) {
      currentChild.kill("SIGTERM");
      console.log(pc.gray("Terminated agent process"));
    }
    session.status = "stopped";
    session.stoppedAt = new Date().toISOString();
    await saveSession(projectPath, session);
    log("Loop stopped by user");
    await notifyTelegram(config, session, "loop_stopped", log);
    logStream.close();
    process.exit(0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  const ctx: TaskLoopContext = {
    projectPath,
    config,
    session,
    agentInstance,
    maxRetries,
    verbose,
    log,
    setCurrentChild: (child) => {
      currentChild = child;
    },
  };

  try {
    while (true) {
      const impl = await parseImplementation(projectPath);
      if (!impl) {
        console.log(pc.red("No implementation.json found."));
        break;
      }

      const next = getNextPendingTask(impl);
      if (!next) {
        console.log(pc.green("\n✓ All tasks completed!"));
        await notifyTelegram(config, session, "loop_completed", log);
        break;
      }

      const { spec, task } = next;
      session.iteration++;
      await saveSession(projectPath, session);

      console.log(
        pc.cyan(`\n📋 Task ${session.iteration}: ${task.description}`)
      );
      console.log(pc.gray(`   Spec: ${spec.name}`));
      log(`Starting task: ${task.id} - ${task.description}`);

      // Mark task as in progress
      markTaskInProgress(impl, spec.id, task.id);
      await saveImplementation(projectPath, impl);

      // Run the task
      const result = await runSingleTask(
        projectPath,
        spec,
        task,
        agentInstance,
        session,
        log,
        verbose,
        ctx.setCurrentChild
      );

      // Handle result based on status
      if (result.status === "blocked") {
        await handleBlockedTask(impl, spec, task, result.reason, ctx);
        continue;
      }

      if (result.status === "done") {
        await handleDoneResult(impl, spec, task, projectPath, ctx);
      } else {
        await handleTaskError(impl, spec, task, ctx);
      }

      console.log(pc.gray(`\n${"=".repeat(50)}\n`));
    }

    session.status = "completed";
    await saveSession(projectPath, session);
    log("Task-level loop completed");
  } finally {
    logStream.close();
  }
}
