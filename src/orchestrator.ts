import { type ChildProcess, spawn } from "node:child_process";
import fse from "fs-extra";
import pc from "picocolors";
import type { BaseAgent } from "./agents/base";
import { MARKERS } from "./constants";
import { Implementation } from "./domain/implementation";
import type { Session } from "./domain/session";
import type { Spec } from "./domain/spec";
import type { Task } from "./domain/task";
import type { Workspace } from "./domain/workspace";
import type { QualityGateResult, RalphConfig, TaskResult } from "./types";
import {
  getFailedGates,
  parseQualityGates,
  runQualityGates,
} from "./utils/quality-gates";
import { generateRetryPrompt, generateTaskPrompt } from "./utils/task-prompts";
import { sendTelegramNotification } from "./utils/telegram";

export interface LoopContext {
  projectPath: string;
  config: RalphConfig;
  workspace: Workspace;
  session: Session;
  agent: BaseAgent;
  log: (msg: string) => void;
  verbose?: boolean;
}

export interface BuildLoopOptions {
  projectPath: string;
  config: RalphConfig;
  workspace: Workspace;
  session: Session;
  logFile: string;
  agent: BaseAgent;
  maxRetries?: number;
  verbose?: boolean;
}

const TASK_BLOCKED_REGEX = /<TASK_BLOCKED\s+reason="([^"]+)">/;

function executeAgent(
  ctx: LoopContext,
  prompt: string,
  onSpawn?: (child: ChildProcess) => void
): Promise<TaskResult> {
  const { projectPath, agent, session, log, verbose } = ctx;
  const cmdOptions = agent.buildCommand({ model: session.model, verbose });

  return new Promise((resolve) => {
    let stdoutBuffer = "";

    const child = spawn(cmdOptions.command, cmdOptions.args, {
      cwd: projectPath,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...cmdOptions.env },
    });

    onSpawn?.(child);
    if (child.pid) {
      session.setPid(child.pid);
    }
    ctx.workspace.sessionManager.update(session);
    ctx.workspace.save().catch(() => {
      // fire-and-forget
    });

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

      if (stdoutBuffer.includes(MARKERS.TASK_DONE)) {
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

async function notify(
  ctx: LoopContext,
  status:
    | "loop_started"
    | "iteration_success"
    | "iteration_failure"
    | "loop_completed"
    | "loop_stopped",
  taskDescription?: string
): Promise<void> {
  const telegram = ctx.config.notifications?.telegram;
  if (!telegram?.enabled) {
    return;
  }

  try {
    await sendTelegramNotification(telegram, {
      projectName: ctx.config.projectName,
      mode: ctx.session.mode,
      sessionId: ctx.session.id,
      iteration: ctx.session.iteration,
      status,
      taskDescription,
    });
  } catch (err) {
    ctx.log(`Telegram notification failed: ${err}`);
  }
}

async function runQualityGatesForTask(
  impl: Implementation,
  ctx: LoopContext,
  spec: Spec,
  task: Task,
  maxRetries: number,
  currentChild: { value: ChildProcess | null }
): Promise<void> {
  const qualityGateCommands = impl.qualityGates;
  if (!qualityGateCommands || qualityGateCommands.length === 0) {
    console.log(pc.gray("\n  Skipping quality gates (not configured)"));
    ctx.log("Quality gates skipped - not configured");
    task.complete();
    await impl.save();
    await notify(ctx, "iteration_success", task.description);
    if (spec.isCompleted) {
      console.log(pc.green(`\n✓ Spec completed: ${spec.name}`));
      ctx.log(`Spec completed: ${spec.name}`);
    }
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
    console.log(pc.green("  ✓ All quality gates passed"));
    ctx.log("All quality gates passed");
    task.complete();
    await impl.save();
    await notify(ctx, "iteration_success", task.description);
    if (spec.isCompleted) {
      console.log(pc.green(`\n✓ Spec completed: ${spec.name}`));
      ctx.log(`Spec completed: ${spec.name}`);
    }
  } else {
    await handleGateFailure(
      impl,
      ctx,
      spec,
      task,
      failedGates,
      maxRetries,
      currentChild
    );
  }
}

async function handleGateFailure(
  impl: Implementation,
  ctx: LoopContext,
  spec: Spec,
  task: Task,
  failedGates: QualityGateResult[],
  maxRetries: number,
  currentChild: { value: ChildProcess | null }
): Promise<void> {
  const retryCount = task.retryCount;

  if (retryCount < maxRetries) {
    console.log(
      pc.yellow(
        `  ⚠ Quality gates failed (retry ${retryCount + 1}/${maxRetries})`
      )
    );
    ctx.log(`Quality gates failed, retrying (${retryCount + 1}/${maxRetries})`);
    task.retry();
    await impl.save();

    const retryPrompt = generateRetryPrompt(
      spec,
      task,
      failedGates,
      retryCount
    );
    await executeAgent(ctx, retryPrompt, (child) => {
      currentChild.value = child;
    });
  } else {
    console.log(pc.red("  ✗ Max retries exceeded for task"));
    ctx.log(`Max retries exceeded for task ${task.id}`);
    task.fail();
    await impl.save();
    await notify(ctx, "iteration_failure", task.description);
  }
}

export async function runBuildLoop(options: BuildLoopOptions): Promise<void> {
  const {
    projectPath,
    config,
    workspace,
    session,
    logFile,
    agent,
    maxRetries = 3,
    verbose,
  } = options;

  const logStream = fse.createWriteStream(logFile, { flags: "a" });
  const currentChild: { value: ChildProcess | null } = { value: null };

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${msg}\n`);
    if (verbose) {
      console.log(pc.gray(`[${timestamp}]`), msg);
    }
  };

  const ctx: LoopContext = {
    projectPath,
    config,
    workspace,
    session,
    agent,
    log,
    verbose,
  };

  ctx.log(`Starting build loop - Session ${session.id}`);
  await notify(ctx, "loop_started");

  const handleSignal = async () => {
    console.log(pc.yellow("\n\nStopping Ralph loop..."));
    if (currentChild.value && !currentChild.value.killed) {
      currentChild.value.kill("SIGTERM");
      console.log(pc.gray("Terminated agent process"));
    }
    session.markStopped();
    workspace.sessionManager.update(session);
    await workspace.save();
    ctx.log("Loop stopped by user");
    await notify(ctx, "loop_stopped");
    logStream.close();
    process.exit(0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  try {
    while (true) {
      const impl = await Implementation.load(projectPath);
      if (!impl) {
        console.log(pc.red("No implementation.json found."));
        break;
      }

      const next = impl.nextPendingTask;
      if (!next) {
        console.log(pc.green("\n✓ All tasks completed!"));
        await notify(ctx, "loop_completed");
        break;
      }

      const { spec, task } = next;
      session.incrementIteration();
      workspace.sessionManager.update(session);
      await workspace.save();

      console.log(
        pc.cyan(`\n📋 Task ${session.iteration}: ${task.description}`)
      );
      console.log(pc.gray(`   Spec: ${spec.name}`));
      ctx.log(`Starting task: ${task.id} - ${task.description}`);

      task.markInProgress();
      await impl.save();

      const taskPrompt = generateTaskPrompt(spec, task);
      const result = await executeAgent(ctx, taskPrompt, (child) => {
        currentChild.value = child;
      });

      if (result.status === "blocked") {
        console.log(pc.yellow(`  ⚠ Task blocked: ${result.reason}`));
        ctx.log(`Task blocked: ${result.reason}`);
        task.block(result.reason || "Unknown");
        await impl.save();
        continue;
      }

      if (result.status === "done") {
        await runQualityGatesForTask(
          impl,
          ctx,
          spec,
          task,
          maxRetries,
          currentChild
        );
      } else {
        console.log(pc.red("  ✗ Task failed"));
        ctx.log(`Task failed: ${task.id}`);
        task.fail();
        await impl.save();
        await notify(ctx, "iteration_failure", task.description);
      }

      console.log(pc.gray(`\n${"=".repeat(50)}\n`));
    }

    session.markCompleted();
    workspace.sessionManager.update(session);
    await workspace.save();
    ctx.log("Build loop completed");
  } finally {
    logStream.close();
  }
}
