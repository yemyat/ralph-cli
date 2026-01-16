import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import fse from "fs-extra";
import ora from "ora";
import pc from "picocolors";
import { getAgent } from "../agents/index";
import {
  getProjectConfig,
  getProjectSessions,
  saveSession,
} from "../config";
import type { AgentType, RalphSession } from "../types";
import { getRalphDir, getSessionLogFile } from "../utils/paths";

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

  const sessionId = randomUUID().slice(0, 8);
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

  console.log(pc.green(`\n🚀 Starting Ralph in ${mode} mode...\n`));
  console.log(`  Session ID: ${pc.cyan(sessionId)}`);
  console.log(`  Agent:      ${pc.cyan(agentInstance.name)}`);
  console.log(`  Model:      ${pc.cyan(model || "default")}`);
  console.log(`  Prompt:     ${pc.cyan(promptFile)}`);
  if (maxIterations > 0) {
    console.log(`  Max Iter:   ${pc.cyan(maxIterations)}`);
  }
  console.log(`  Log:        ${pc.gray(logFile)}`);
  console.log();
  console.log(pc.gray("Press Ctrl+C to stop the loop.\n"));

  await runRalphLoop(
    projectPath,
    session,
    logFile,
    promptPath,
    agentInstance,
    maxIterations,
    options.verbose
  );
}

const DONE_MARKER = "<STATUS>DONE</STATUS>";

async function runRalphLoop(
  projectPath: string,
  session: RalphSession,
  logFile: string,
  promptPath: string,
  agentInstance: ReturnType<typeof getAgent>,
  maxIterations: number,
  verbose?: boolean
): Promise<void> {
  let iteration = 0;
  let doneDetected = false;
  const logStream = fse.createWriteStream(logFile, { flags: "a" });

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${msg}\n`);
    if (verbose) {
      console.log(pc.gray(`[${timestamp}]`), msg);
    }
  };

  log(`Starting Ralph loop - Session ${session.id}`);

  const handleSignal = async () => {
    console.log(pc.yellow("\n\nStopping Ralph loop..."));
    session.status = "stopped";
    session.stoppedAt = new Date().toISOString();
    await saveSession(projectPath, session);
    log(`Loop stopped by user after ${iteration} iterations`);
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

          const child = spawn(cmdOptions.command, cmdOptions.args, {
            cwd: process.cwd(),
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, ...cmdOptions.env },
          });

          child.stdin.write(promptContent);
          child.stdin.end();

          child.stdout.on("data", (data) => {
            const output = data.toString();
            log(`[stdout] ${output}`);
            if (verbose) {
              process.stdout.write(output);
            }
            stdoutBuffer += output;
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

          session.pid = child.pid;
          saveSession(projectPath, session);
        });

        spinner.succeed(`Iteration ${iteration} completed`);

        if (doneDetected) {
          console.log(
            pc.green("\n✓ All tasks completed! Agent signaled DONE.")
          );
          break;
        }

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
