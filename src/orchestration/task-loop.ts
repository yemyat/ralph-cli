/**
 * Task-level orchestration loop.
 * Main entry point for running the build loop.
 */

import type { spawn } from "node:child_process";
import fse from "fs-extra";
import pc from "picocolors";
import type { getAgent } from "../agents/index";
import { saveSession } from "../config";
import type {
  Implementation,
  RalphConfig,
  RalphSession,
  SpecEntry,
  TaskEntry,
} from "../types";
import {
  getNextPendingTask,
  markTaskFailed,
  markTaskInProgress,
  parseImplementation,
  saveImplementation,
} from "../utils/implementation";
import {
  getFailedGates,
  parseQualityGates,
  runQualityGates,
} from "../utils/quality-gates";
import { runRetryTask, runSingleTask } from "./agent-executor";
import { notifyTelegram } from "./notifications";
import {
  handleBlockedTask,
  handleGatesFailed,
  handleGatesPassed,
  type TaskLoopContext,
} from "./task-handlers";
import type { LoopContext } from "./types";

export interface TaskLoopOptions {
  maxRetries?: number;
  verbose?: boolean;
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

  const loopContext: LoopContext = {
    projectPath,
    config,
    session,
    agent: agentInstance,
    log,
    verbose,
  };

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
    runRetryTask: async (spec, task, failedGates, retryCount) => {
      await runRetryTask(loopContext, {
        spec,
        task,
        failedGates,
        retryCount,
        onSpawn: ctx.setCurrentChild,
      });
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
      const result = await runSingleTask(loopContext, {
        spec,
        task,
        onSpawn: ctx.setCurrentChild,
      });

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
