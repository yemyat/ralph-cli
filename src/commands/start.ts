import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import fse from "fs-extra";
import ora from "ora";
import pc from "picocolors";
import { getAgent } from "../agents/index";
import { getProjectConfig, getProjectSessions, saveSession } from "../config";
import type {
  AgentType,
  Implementation,
  QualityGateResult,
  RalphConfig,
  RalphSession,
  SpecEntry,
  TaskEntry,
} from "../types";
import {
  getCurrentSpecId,
  getNextPendingTask,
  markTaskBlocked,
  markTaskCompleted,
  markTaskFailed,
  markTaskInProgress,
  parseImplementation,
  resetTaskToPending,
  saveImplementation,
} from "../utils/implementation";
import { getRalphDir, getSessionLogFile } from "../utils/paths";
import {
  DEFAULT_QUALITY_GATES,
  getFailedGates,
  runQualityGates,
} from "../utils/quality-gates";
import { generateRetryPrompt, generateTaskPrompt } from "../utils/task-prompts";
import {
  type NotificationPayload,
  type NotificationStatus,
  sendTelegramNotification,
} from "../utils/telegram";

interface StartOptions {
  agent?: AgentType;
  model?: string;
  maxIterations?: number;
  verbose?: boolean;
}

export async function startCommand(
  mode: "plan" | "build",
  options: StartOptions
): Promise<void> {
  const projectPath = process.cwd();
  const config = await getProjectConfig(projectPath);

  if (!config) {
    console.log(pc.red("Ralph is not initialized for this project."));
    console.log(`Run ${pc.cyan("ralph-wiggum-cli init")} first.`);
    return;
  }

  const sessions = await getProjectSessions(projectPath);
  const runningSessions = sessions.filter((s) => s.status === "running");

  if (runningSessions.length > 0) {
    console.log(
      pc.yellow("There's already a running Ralph session for this project.")
    );
    console.log(`  Session ID: ${pc.cyan(runningSessions[0].id)}`);
    console.log(`  Mode: ${pc.cyan(runningSessions[0].mode)}`);
    console.log(`\nUse ${pc.cyan("ralph-wiggum-cli stop")} to stop it first.`);
    return;
  }

  const modeConfig = config.agents[mode];
  const agent = options.agent || modeConfig.agent;
  const model = options.model || modeConfig.model;
  const maxIterations = options.maxIterations || 0;

  const agentInstance = getAgent(agent);
  const isInstalled = await agentInstance.checkInstalled();

  if (!isInstalled) {
    console.log(pc.red(`\n${agentInstance.name} is not installed.\n`));
    console.log(agentInstance.getInstallInstructions());
    return;
  }

  const promptFile = mode === "plan" ? "PROMPT_plan.md" : "PROMPT_build.md";
  const ralphDir = getRalphDir(projectPath);
  const promptPath = join(ralphDir, promptFile);

  if (!(await fse.pathExists(promptPath))) {
    console.log(pc.red(`Prompt file not found: ${promptFile}`));
    console.log(`Run ${pc.cyan("ralph-wiggum-cli init")} to create it.`);
    return;
  }

  const currentSpec =
    mode === "build" ? await getCurrentSpecId(projectPath) : null;
  const specSuffix = currentSpec ? `-${currentSpec}` : `-${mode}`;
  const sessionId = `${randomUUID().slice(0, 8)}${specSuffix}`;
  const logFile = getSessionLogFile(projectPath, sessionId);

  const session: RalphSession = {
    id: sessionId,
    mode,
    status: "running",
    iteration: 0,
    startedAt: new Date().toISOString(),
    agent,
    model,
  };

  // Check if we should use task-level orchestration for build mode
  const impl = mode === "build" ? await parseImplementation(projectPath) : null;
  const useTaskLevel = mode === "build" && impl && impl.specs.length > 0;

  console.log(pc.green(`\n🚀 Starting Ralph in ${mode} mode...\n`));
  console.log(`  Session ID: ${pc.cyan(sessionId)}`);
  console.log(`  Agent:      ${pc.cyan(agentInstance.name)}`);
  console.log(`  Model:      ${pc.cyan(model || "default")}`);
  if (useTaskLevel) {
    console.log(`  Mode:       ${pc.cyan("task-level orchestration")}`);
  } else {
    console.log(`  Prompt:     ${pc.cyan(promptFile)}`);
  }
  if (maxIterations > 0) {
    console.log(`  Max Iter:   ${pc.cyan(maxIterations)}`);
  }
  console.log(`  Log:        ${pc.gray(logFile)}`);
  console.log();
  console.log(pc.gray("Press Ctrl+C to stop the loop.\n"));

  if (useTaskLevel) {
    // Use task-level orchestration for build mode
    await runTaskLevelLoop(
      projectPath,
      config,
      session,
      logFile,
      agentInstance,
      {
        maxRetries: 3,
        verbose: options.verbose,
      }
    );
  } else {
    // Use legacy spec-level orchestration
    await runRalphLoop(
      projectPath,
      config,
      session,
      logFile,
      promptPath,
      agentInstance,
      maxIterations,
      options.verbose
    );
  }
}

const DONE_MARKER = "<STATUS>DONE</STATUS>";
const TASK_DONE_MARKER = "<TASK_DONE>";
const TASK_BLOCKED_REGEX = /<TASK_BLOCKED\s+reason="([^"]+)">/;

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

async function runRalphLoop(
  projectPath: string,
  config: RalphConfig,
  session: RalphSession,
  logFile: string,
  promptPath: string,
  agentInstance: ReturnType<typeof getAgent>,
  maxIterations: number,
  verbose?: boolean
): Promise<void> {
  let iteration = 0;
  let doneDetected = false;
  let currentChild: ReturnType<typeof spawn> | null = null;
  const logStream = fse.createWriteStream(logFile, { flags: "a" });

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${msg}\n`);
    if (verbose) {
      console.log(pc.gray(`[${timestamp}]`), msg);
    }
  };

  log(`Starting Ralph loop - Session ${session.id}`);

  // Send loop started notification
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
    log(`Loop stopped by user after ${iteration} iterations`);

    // Send stopped notification
    await notifyTelegram(config, session, "loop_stopped", log);

    logStream.close();
    process.exit(0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  try {
    while (true) {
      if (maxIterations > 0 && iteration >= maxIterations) {
        console.log(pc.green(`\n✓ Reached max iterations: ${maxIterations}`));
        break;
      }

      iteration++;
      session.iteration = iteration;
      await saveSession(projectPath, session);

      const spinner = ora(`Iteration ${iteration}`).start();
      log(`Starting iteration ${iteration}`);

      try {
        const promptContent = await fse.readFile(promptPath, "utf-8");

        const cmdOptions = agentInstance.buildCommand({
          model: session.model,
          promptFile: promptPath,
          verbose,
        });

        await new Promise<void>((resolve, reject) => {
          let stdoutBuffer = "";

          currentChild = spawn(cmdOptions.command, cmdOptions.args, {
            cwd: process.cwd(),
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, ...cmdOptions.env },
          });

          currentChild.stdin?.write(promptContent);
          currentChild.stdin?.end();

          currentChild.stdout?.on("data", (data) => {
            const output = data.toString();
            log(`[stdout] ${output}`);
            if (verbose) {
              process.stdout.write(output);
            }
            stdoutBuffer += output;
          });

          currentChild.stderr?.on("data", (data) => {
            const output = data.toString();
            log(`[stderr] ${output}`);
            if (verbose) {
              process.stderr.write(output);
            }
          });

          currentChild.on("error", (err) => {
            log(`Error: ${err.message}`);
            reject(err);
          });

          currentChild.on("close", (code) => {
            log(`Iteration ${iteration} completed with exit code ${code}`);

            const tailOutput = stdoutBuffer.slice(-2000);
            if (tailOutput.includes(DONE_MARKER)) {
              doneDetected = true;
              log("Detected DONE marker in output tail");
            }

            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Process exited with code ${code}`));
            }
          });

          session.pid = currentChild.pid;
          saveSession(projectPath, session);
        });

        spinner.succeed(`Iteration ${iteration} completed`);

        if (doneDetected) {
          // Send loop completed notification
          await notifyTelegram(config, session, "loop_completed", log);
          console.log(
            pc.green("\n✓ All tasks completed! Agent signaled DONE.")
          );
          break;
        }

        // Send iteration success notification
        await notifyTelegram(config, session, "iteration_success", log);

        if (session.mode === "build") {
          try {
            const { execSync } = await import("node:child_process");
            const branch = execSync("git branch --show-current", {
              encoding: "utf-8",
            }).trim();
            execSync(`git push origin ${branch}`, { stdio: "pipe" });
            log(`Pushed to origin/${branch}`);
          } catch (e) {
            log(`Git push skipped or failed: ${e}`);
          }
        }
      } catch (err) {
        spinner.fail(`Iteration ${iteration} failed`);
        log(`Iteration ${iteration} failed: ${err}`);

        // Send iteration failure notification
        await notifyTelegram(config, session, "iteration_failure", log);
      }

      console.log(
        pc.gray(`\n${"=".repeat(20)} LOOP ${iteration} ${"=".repeat(20)}\n`)
      );
    }

    session.status = "completed";
    await saveSession(projectPath, session);
    log(`Loop completed after ${iteration} iterations`);
  } finally {
    logStream.close();
  }
}

// ============================================================================
// Task-Level Orchestration (New)
// ============================================================================

interface TaskLoopOptions {
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
    await commitSpecCompletion(ctx.projectPath, spec.name, ctx.log);
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
 * Run the task-level build loop.
 * Processes one task at a time with external quality gates.
 */
async function runTaskLevelLoop(
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

/**
 * Handle a done task result - run quality gates.
 */
async function handleDoneResult(
  impl: Implementation,
  spec: SpecEntry,
  task: TaskEntry,
  projectPath: string,
  ctx: TaskLoopContext
): Promise<void> {
  console.log(pc.gray("\n  Running quality gates..."));
  ctx.log("Running quality gates");

  const gateResults = await runQualityGates(
    DEFAULT_QUALITY_GATES,
    projectPath,
    {
      onGateStart: (gate) => console.log(pc.gray(`    ⏳ ${gate.name}...`)),
      onGateComplete: (r) => {
        const icon = r.passed ? pc.green("✓") : pc.red("✗");
        console.log(`    ${icon} ${r.name}`);
      },
    }
  );

  const failedGates = getFailedGates(gateResults);

  if (failedGates.length === 0) {
    await handleGatesPassed(impl, spec, task, ctx);
  } else {
    await handleGatesFailed(impl, spec, task, failedGates, ctx);
  }
}

interface TaskResult {
  status: "done" | "blocked" | "error";
  reason?: string;
  output: string;
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
      if (stdoutBuffer.includes(TASK_DONE_MARKER)) {
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
 * Commit after spec completion.
 */
async function commitSpecCompletion(
  projectPath: string,
  specName: string,
  log: (msg: string) => void
): Promise<void> {
  try {
    const { execSync } = await import("node:child_process");
    execSync("git add -A", { cwd: projectPath, stdio: "pipe" });
    execSync(`git commit -m "feat: ${specName}"`, {
      cwd: projectPath,
      stdio: "pipe",
    });
    const branch = execSync("git branch --show-current", {
      cwd: projectPath,
      encoding: "utf-8",
    }).trim();
    execSync(`git push origin ${branch}`, { cwd: projectPath, stdio: "pipe" });
    log(`Committed and pushed: feat: ${specName}`);
    console.log(pc.green(`  📦 Committed and pushed: ${specName}`));
  } catch (e) {
    log(`Git commit/push failed: ${e}`);
    console.log(pc.yellow("  ⚠ Git commit/push failed"));
  }
}
