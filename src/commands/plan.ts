import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import fse from "fs-extra";
import pc from "picocolors";
import { saveSession } from "../config";
import { FILES } from "../constants";
import type { PlanOptions, RalphSession } from "../types";
import { getRalphDir, getSessionLogFile } from "../utils/paths";
import { resolveContext } from "./hooks";

export async function planCommand(options: PlanOptions): Promise<void> {
  const ctx = await resolveContext({
    mode: "plan",
    agentOverride: options.agent,
    modelOverride: options.model,
  });
  if (!ctx) {
    return;
  }

  const promptPath = join(getRalphDir(ctx.projectPath), FILES.PROMPT_PLAN);
  if (!(await fse.pathExists(promptPath))) {
    console.log(pc.red(`Prompt file not found: ${FILES.PROMPT_PLAN}`));
    console.log(`Run ${pc.cyan("ralph-wiggum-cli init")} to create it.`);
    return;
  }

  const sessionId = `${randomUUID().slice(0, 8)}-plan`;
  const logFile = getSessionLogFile(ctx.projectPath, sessionId);

  const session: RalphSession = {
    id: sessionId,
    mode: "plan",
    status: "running",
    iteration: 0,
    startedAt: new Date().toISOString(),
    agent: ctx.agentType,
    model: ctx.model,
  };

  console.log(pc.green("\n🚀 Starting Ralph plan mode...\n"));
  console.log(`  Session: ${pc.cyan(sessionId)}`);
  console.log(`  Agent:   ${pc.cyan(ctx.agent.name)}`);
  console.log(`  Model:   ${pc.cyan(ctx.model || "default")}`);
  console.log(`  Prompt:  ${pc.cyan(FILES.PROMPT_PLAN)}`);
  console.log(`  Log:     ${pc.gray(logFile)}`);
  console.log(pc.gray("\nPress Ctrl+C to stop.\n"));

  const prompt = await fse.readFile(promptPath, "utf-8");
  const cmdOptions = ctx.agent.buildCommand({
    model: ctx.model,
    verbose: options.verbose,
  });
  const logStream = fse.createWriteStream(logFile, { flags: "a" });

  const child = spawn(cmdOptions.command, cmdOptions.args, {
    cwd: ctx.projectPath,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...cmdOptions.env },
  });

  session.pid = child.pid;
  await saveSession(ctx.projectPath, session);

  child.stdin?.write(prompt);
  child.stdin?.end();

  child.stdout?.on("data", (data) => {
    const output = data.toString();
    logStream.write(`[stdout] ${output}`);
    if (options.verbose) {
      process.stdout.write(output);
    }
  });

  child.stderr?.on("data", (data) => {
    const output = data.toString();
    logStream.write(`[stderr] ${output}`);
    if (options.verbose) {
      process.stderr.write(output);
    }
  });

  const handleSignal = async () => {
    console.log(pc.yellow("\n\nStopping..."));
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    session.status = "stopped";
    session.stoppedAt = new Date().toISOString();
    await saveSession(ctx.projectPath, session);
    logStream.close();
    process.exit(0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  child.on("close", async (code) => {
    session.status = code === 0 ? "completed" : "stopped";
    session.stoppedAt = new Date().toISOString();
    await saveSession(ctx.projectPath, session);
    logStream.close();
    console.log(pc.green(`\n✓ Plan mode completed (exit code: ${code})`));
  });
}
