import pc from "picocolors";
import { Implementation } from "../domain/implementation";
import { Session } from "../domain/session";
import { runBuildLoop } from "../orchestrator";
import type { BuildOptions } from "../types";
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

  const session = Session.create({
    mode: "build",
    agent: ctx.agentType,
    model: ctx.model,
  });
  const logFile = getSessionLogFile(ctx.projectPath, session.id);

  console.log(pc.green("\n🚀 Starting Ralph build loop...\n"));
  console.log(`  Session: ${pc.cyan(session.id)}`);
  console.log(`  Agent:   ${pc.cyan(ctx.agent.name)}`);
  console.log(`  Model:   ${pc.cyan(ctx.model || "default")}`);
  console.log(`  Log:     ${pc.gray(logFile)}`);
  console.log(pc.gray("\nPress Ctrl+C to stop.\n"));

  ctx.workspace.sessionManager.add(session);
  await ctx.workspace.save();

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
