/**
 * Task-level orchestration loop.
 * Main entry point for running the build loop.
 */

import type { spawn } from "node:child_process";
import fse from "fs-extra";
import pc from "picocolors";
import { saveSession } from "../config";
import type { Implementation } from "../types";
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
} from "./task-handlers";
import type {
  DoneResultOptions,
  GatesFailedOptions,
  LoopContext,
  TaskContext,
  TaskLevelLoopOptions,
} from "./types";

/**
 * Handle task error.
 */
async function handleTaskError(
  impl: Implementation,
  ctx: LoopContext,
  taskCtx: TaskContext
): Promise<void> {
  const { spec, task } = taskCtx;
  console.log(pc.red("  ✗ Task failed"));
  ctx.log(`Task failed: ${task.id}`);
  markTaskFailed(impl, spec.id, task.id);
  await saveImplementation(ctx.projectPath, impl);
  await notifyTelegram({
    config: ctx.config,
    session: ctx.session,
    status: "iteration_failure",
    log: ctx.log,
    taskDescription: task.description,
  });
}

/**
 * Handle a done task result - run quality gates.
 * If qualityGates is not defined in implementation.json, skip verification.
 */
async function handleDoneResult(
  impl: Implementation,
  ctx: LoopContext,
  options: DoneResultOptions
): Promise<void> {
  const { spec, task, gatesFailedOptions } = options;
  const taskCtx: TaskContext = { spec, task };

  // Skip quality gate verification if not defined or empty
  const qualityGateCommands = impl.qualityGates;
  if (!qualityGateCommands || qualityGateCommands.length === 0) {
    console.log(pc.gray("\n  Skipping quality gates (not configured)"));
    ctx.log("Quality gates skipped - not configured in implementation.json");
    await handleGatesPassed(impl, ctx, taskCtx);
    return;
  }

  console.log(pc.gray("\n  Running quality gates..."));
  ctx.log("Running quality gates");

  const gates = parseQualityGates(qualityGateCommands);
  const gateResults = await runQualityGates(gates, ctx.projectPath, {
    onGateStart: (gate) => console.log(pc.gray(`    ⏳ ${gate.name}...`)),
    onGateComplete: (r) => {
      const icon = r.passed ? pc.green("✓") : pc.red("✗");
      console.log(`    ${icon} ${r.name}`);
    },
  });

  const failedGates = getFailedGates(gateResults);

  if (failedGates.length === 0) {
    await handleGatesPassed(impl, ctx, taskCtx);
  } else {
    await handleGatesFailed(impl, ctx, {
      taskCtx,
      failedGates,
      retryOptions: gatesFailedOptions,
    });
  }
}

/**
 * Run the task-level build loop.
 * Processes one task at a time with external quality gates.
 */
export async function runTaskLevelLoop(
  options: TaskLevelLoopOptions
): Promise<void> {
  const {
    projectPath,
    config,
    session,
    logFile,
    agent: agentInstance,
    maxRetries = 3,
    verbose,
  } = options;

  const logStream = fse.createWriteStream(logFile, { flags: "a" });
  let currentChild: ReturnType<typeof spawn> | null = null;

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${msg}\n`);
    if (verbose) {
      console.log(pc.gray(`[${timestamp}]`), msg);
    }
  };

  // Create loop context at entry - used by all sub-functions
  const loopContext: LoopContext = {
    projectPath,
    config,
    session,
    agent: agentInstance,
    log,
    verbose,
  };

  loopContext.log(
    `Starting task-level loop - Session ${loopContext.session.id}`
  );
  await notifyTelegram({
    config: loopContext.config,
    session: loopContext.session,
    status: "loop_started",
    log: loopContext.log,
  });

  const handleSignal = async () => {
    console.log(pc.yellow("\n\nStopping Ralph loop..."));
    if (currentChild && !currentChild.killed) {
      currentChild.kill("SIGTERM");
      console.log(pc.gray("Terminated agent process"));
    }
    loopContext.session.status = "stopped";
    loopContext.session.stoppedAt = new Date().toISOString();
    await saveSession(loopContext.projectPath, loopContext.session);
    loopContext.log("Loop stopped by user");
    await notifyTelegram({
      config: loopContext.config,
      session: loopContext.session,
      status: "loop_stopped",
      log: loopContext.log,
    });
    logStream.close();
    process.exit(0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  const setCurrentChild = (child: ReturnType<typeof spawn>) => {
    currentChild = child;
  };

  const gatesFailedOptions: GatesFailedOptions = {
    maxRetries,
    runRetryTask: async (spec, task, failedGates, retryCount) => {
      await runRetryTask(loopContext, {
        spec,
        task,
        failedGates,
        retryCount,
        onSpawn: setCurrentChild,
      });
    },
  };

  try {
    while (true) {
      const impl = await parseImplementation(loopContext.projectPath);
      if (!impl) {
        console.log(pc.red("No implementation.json found."));
        break;
      }

      const next = getNextPendingTask(impl);
      if (!next) {
        console.log(pc.green("\n✓ All tasks completed!"));
        await notifyTelegram({
          config: loopContext.config,
          session: loopContext.session,
          status: "loop_completed",
          log: loopContext.log,
        });
        break;
      }

      const { spec, task } = next;
      loopContext.session.iteration++;
      await saveSession(loopContext.projectPath, loopContext.session);

      console.log(
        pc.cyan(
          `\n📋 Task ${loopContext.session.iteration}: ${task.description}`
        )
      );
      console.log(pc.gray(`   Spec: ${spec.name}`));
      loopContext.log(`Starting task: ${task.id} - ${task.description}`);

      // Mark task as in progress
      markTaskInProgress(impl, spec.id, task.id);
      await saveImplementation(loopContext.projectPath, impl);

      // Run the task
      const result = await runSingleTask(loopContext, {
        spec,
        task,
        onSpawn: setCurrentChild,
      });

      // Handle result based on status
      if (result.status === "blocked") {
        await handleBlockedTask(impl, loopContext, {
          spec,
          task,
          reason: result.reason,
        });
        continue;
      }

      if (result.status === "done") {
        await handleDoneResult(impl, loopContext, {
          spec,
          task,
          gatesFailedOptions,
        });
      } else {
        await handleTaskError(impl, loopContext, { spec, task });
      }

      console.log(pc.gray(`\n${"=".repeat(50)}\n`));
    }

    loopContext.session.status = "completed";
    await saveSession(loopContext.projectPath, loopContext.session);
    loopContext.log("Task-level loop completed");
  } finally {
    logStream.close();
  }
}
