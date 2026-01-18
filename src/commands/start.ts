import { randomUUID } from "node:crypto";
import { join } from "node:path";
import fse from "fs-extra";
import pc from "picocolors";
import { getAgent } from "../agents/index";
import { getProjectConfig, getProjectSessions } from "../config";
import { runTaskLevelLoop } from "../orchestration/task-loop";
import type { AgentType, RalphSession } from "../types";
import { getCurrentSpecId, parseImplementation } from "../utils/implementation";
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

  const ralphDir = getRalphDir(projectPath);

  // Build mode requires implementation.json with specs
  if (mode === "build") {
    const impl = await parseImplementation(projectPath);
    if (!impl || impl.specs.length === 0) {
      console.log(pc.red("No specs found in implementation.json"));
      console.log(
        `Run ${pc.cyan("ralph-wiggum-cli plan")} first to create specs.`
      );
      return;
    }
  }

  // Plan mode requires PROMPT_plan.md
  const promptFile = "PROMPT_plan.md";
  const promptPath = join(ralphDir, promptFile);

  if (mode === "plan" && !(await fse.pathExists(promptPath))) {
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

  console.log(pc.green(`\n🚀 Starting Ralph in ${mode} mode...\n`));
  console.log(`  Session ID: ${pc.cyan(sessionId)}`);
  console.log(`  Agent:      ${pc.cyan(agentInstance.name)}`);
  console.log(`  Model:      ${pc.cyan(model || "default")}`);
  if (mode === "build") {
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

  if (mode === "build") {
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
  }
}
