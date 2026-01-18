import { randomUUID } from "node:crypto";
import pc from "picocolors";
import { Implementation } from "../domain/implementation";
import { runBuildLoop } from "../orchestrator";
import type { BuildOptions, RalphSession } from "../types";
import { getSessionLogFile } from "../utils/paths";
import { resolveContext } from "./hooks";

export async function buildCommand(options: BuildOptions): Promise<void> {
  const ctx = await resolveContext({
    mode: "build",
    agentOverride: options.agent,
    modelOverride: options.model,
  });
  if (!ctx) {
    return;
  }

  const impl = await Implementation.load(ctx.projectPath);
  if (!impl || impl.specs.length === 0) {
    console.log(pc.red("No specs found in implementation.json"));
    console.log(`Run ${pc.cyan("ralph-wiggum-cli plan")} first.`);
    return;
  }

  const sessionId = `${randomUUID().slice(0, 8)}-build`;
  const logFile = getSessionLogFile(ctx.projectPath, sessionId);

  const session: RalphSession = {
    id: sessionId,
    mode: "build",
    status: "running",
    iteration: 0,
    startedAt: new Date().toISOString(),
    agent: ctx.agentType,
    model: ctx.model,
  };

  console.log(pc.green("\n🚀 Starting Ralph build loop...\n"));
  console.log(`  Session: ${pc.cyan(sessionId)}`);
  console.log(`  Agent:   ${pc.cyan(ctx.agent.name)}`);
  console.log(`  Model:   ${pc.cyan(ctx.model || "default")}`);
  console.log(`  Log:     ${pc.gray(logFile)}`);
  console.log(pc.gray("\nPress Ctrl+C to stop.\n"));

  await ctx.workspace.addSession(session);

  await runBuildLoop({
    projectPath: ctx.projectPath,
    config: ctx.config,
    workspace: ctx.workspace,
    session,
    logFile,
    agent: ctx.agent,
    maxRetries: 3,
    verbose: options.verbose,
  });
}
