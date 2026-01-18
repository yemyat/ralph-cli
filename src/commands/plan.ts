import { spawn } from "node:child_process";
import { join } from "node:path";
import fse from "fs-extra";
import pc from "picocolors";
import { FILES } from "../constants";
import { Session } from "../domain/session";
import type { PlanOptions } from "../types";
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

  const promptPath = join(getRalphDir(), FILES.PROMPT_PLAN);
  if (!(await fse.pathExists(promptPath))) {
    console.log(pc.red(`Prompt file not found: ${FILES.PROMPT_PLAN}`));
    console.log(`Run ${pc.cyan("ralph-wiggum-cli init")} to create it.`);
    return;
  }

  const session = Session.create({
    mode: "plan",
    agent: ctx.agentType,
    model: ctx.model,
  });
  const logFile = getSessionLogFile(session.id);

  console.log(pc.green("\n🚀 Starting Ralph plan mode...\n"));
  console.log(`  Session: ${pc.cyan(session.id)}`);
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
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...cmdOptions.env },
  });

  if (child.pid) {
    session.setPid(child.pid);
  }
  ctx.workspace.sessionManager.add(session);
  await ctx.workspace.save();

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
    session.markStopped();
    ctx.workspace.sessionManager.update(session);
    await ctx.workspace.save();
    logStream.close();
    process.exit(0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  child.on("close", async (code) => {
    if (code === 0) {
      session.markCompleted();
    } else {
      session.markStopped();
    }
    ctx.workspace.sessionManager.update(session);
    await ctx.workspace.save();
    logStream.close();
    console.log(pc.green(`\n✓ Plan mode completed (exit code: ${code})`));
  });
}
