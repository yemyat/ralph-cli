import { join } from "node:path";
import fse from "fs-extra";
import pc from "picocolors";
import { FILES } from "../constants";
import { Session } from "../domain/session";
import { Planner } from "../services/planner";
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

  ctx.workspace.sessionManager.add(session);
  await ctx.workspace.save();

  const planner = new Planner({
    workspace: ctx.workspace,
    session,
    logFile,
    agent: ctx.agent,
    prompt,
    verbose: options.verbose,
  });

  await planner.run();
}
