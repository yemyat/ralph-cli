import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import chalk from "chalk";
import fse from "fs-extra";
import ora from "ora";
import { getAgent } from "../agents/index.js";
import {
  getProjectConfig,
  getProjectSessions,
  saveSession,
} from "../config.js";
import type { AgentType, RalphSession } from "../types.js";
import { getSessionLogFile } from "../utils/paths.js";

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
    console.log(chalk.red("Ralph is not initialized for this project."));
    console.log(`Run ${chalk.cyan("ralph-wiggum-cli init")} first.`);
    return;
  }

  // Check for existing running sessions
  const sessions = await getProjectSessions(config.projectId);
  const runningSessions = sessions.filter((s) => s.status === "running");

  if (runningSessions.length > 0) {
    console.log(
      chalk.yellow("There's already a running Ralph session for this project.")
    );
    console.log(`  Session ID: ${chalk.cyan(runningSessions[0].id)}`);
    console.log(`  Mode: ${chalk.cyan(runningSessions[0].mode)}`);
    console.log(
      `\nUse ${chalk.cyan("ralph-wiggum-cli stop")} to stop it first.`
    );
    return;
  }

  const agent = options.agent || config.agent;
  const model = options.model || config.model;
  const maxIterations = options.maxIterations || 0;

  const agentInstance = getAgent(agent);
  const isInstalled = await agentInstance.checkInstalled();

  if (!isInstalled) {
    console.log(chalk.red(`\n${agentInstance.name} is not installed.\n`));
    console.log(agentInstance.getInstallInstructions());
    return;
  }

  // Determine prompt file
  const promptFile = mode === "plan" ? "PROMPT_plan.md" : "PROMPT_build.md";
  const ralphDir = join(projectPath, ".ralph");
  const promptPath = join(ralphDir, promptFile);

  if (!(await fse.pathExists(promptPath))) {
    console.log(chalk.red(`Prompt file not found: ${promptFile}`));
    console.log(`Run ${chalk.cyan("ralph-wiggum-cli init")} to create it.`);
    return;
  }

  // Create session
  const sessionId = randomUUID().slice(0, 8);
  const logFile = getSessionLogFile(sessionId);

  const session: RalphSession = {
    id: sessionId,
    projectId: config.projectId,
    mode,
    status: "running",
    iteration: 0,
    startedAt: new Date().toISOString(),
    agent,
    model,
    logFile,
  };

  console.log(chalk.green(`\n🚀 Starting Ralph in ${mode} mode...\n`));
  console.log(`  Session ID: ${chalk.cyan(sessionId)}`);
  console.log(`  Agent:      ${chalk.cyan(agentInstance.name)}`);
  console.log(`  Model:      ${chalk.cyan(model || "default")}`);
  console.log(`  Prompt:     ${chalk.cyan(promptFile)}`);
  if (maxIterations > 0) {
    console.log(`  Max Iter:   ${chalk.cyan(maxIterations)}`);
  }
  console.log(`  Log:        ${chalk.gray(logFile)}`);
  console.log();
  console.log(chalk.gray("Press Ctrl+C to stop the loop.\n"));

  // Start the loop
  await runRalphLoop(
    session,
    promptPath,
    agentInstance,
    maxIterations,
    options.verbose
  );
}

const DONE_MARKER = "<STATUS>DONE</STATUS>";

async function runRalphLoop(
  session: RalphSession,
  promptPath: string,
  agentInstance: ReturnType<typeof getAgent>,
  maxIterations: number,
  verbose?: boolean
): Promise<void> {
  let iteration = 0;
  let doneDetected = false;
  const logStream = fse.createWriteStream(session.logFile, { flags: "a" });

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${msg}\n`);
    if (verbose) {
      console.log(chalk.gray(`[${timestamp}]`), msg);
    }
  };

  log(`Starting Ralph loop - Session ${session.id}`);

  const handleSignal = async () => {
    console.log(chalk.yellow("\n\nStopping Ralph loop..."));
    session.status = "stopped";
    session.stoppedAt = new Date().toISOString();
    await saveSession(session);
    log(`Loop stopped by user after ${iteration} iterations`);
    logStream.close();
    process.exit(0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  try {
    while (true) {
      if (maxIterations > 0 && iteration >= maxIterations) {
        console.log(
          chalk.green(`\n✓ Reached max iterations: ${maxIterations}`)
        );
        break;
      }

      iteration++;
      session.iteration = iteration;
      await saveSession(session);

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
          const child = spawn(cmdOptions.command, cmdOptions.args, {
            cwd: process.cwd(),
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, ...cmdOptions.env },
          });

          // Feed prompt via stdin
          child.stdin.write(promptContent);
          child.stdin.end();

          child.stdout.on("data", (data) => {
            const output = data.toString();
            log(`[stdout] ${output}`);
            if (verbose) {
              process.stdout.write(output);
            }
            if (output.includes(DONE_MARKER)) {
              doneDetected = true;
              log("Detected DONE marker in output");
            }
          });

          child.stderr.on("data", (data) => {
            const output = data.toString();
            log(`[stderr] ${output}`);
            if (verbose) {
              process.stderr.write(output);
            }
          });

          child.on("error", (err) => {
            log(`Error: ${err.message}`);
            reject(err);
          });

          child.on("close", (code) => {
            log(`Iteration ${iteration} completed with exit code ${code}`);
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Process exited with code ${code}`));
            }
          });

          session.pid = child.pid;
          saveSession(session);
        });

        spinner.succeed(`Iteration ${iteration} completed`);

        if (doneDetected) {
          console.log(
            chalk.green("\n✓ All tasks completed! Agent signaled DONE.")
          );
          break;
        }

        // Git push after each iteration (if in build mode)
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
        // Continue to next iteration
      }

      console.log(
        chalk.gray(`\n${"=".repeat(20)} LOOP ${iteration} ${"=".repeat(20)}\n`)
      );
    }

    session.status = "completed";
    await saveSession(session);
    log(`Loop completed after ${iteration} iterations`);
  } finally {
    logStream.close();
  }
}
