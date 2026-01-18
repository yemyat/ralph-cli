import pc from "picocolors";
import type { BaseAgent } from "../agents/base";
import { getAgent } from "../agents/index";
import { getProjectConfig, getProjectSessions } from "../config";
import type { AgentType, RalphConfig, ResolveContextOptions } from "../types";

export interface CommandContext {
  projectPath: string;
  config: RalphConfig;
  agent: BaseAgent;
  agentType: AgentType;
  model?: string;
}

/**
 * Resolve command context with all common checks:
 * - Project is initialized
 * - No running sessions
 * - Agent is installed
 *
 * Returns null if any check fails (error already printed).
 */
export async function resolveContext(
  options: ResolveContextOptions
): Promise<CommandContext | null> {
  const projectPath = process.cwd();

  // Check initialized
  const config = await getProjectConfig(projectPath);
  if (!config) {
    console.log(
      pc.red("Ralph is not initialized. Run `ralph-wiggum-cli init` first.")
    );
    return null;
  }

  // Check no running session
  const sessions = await getProjectSessions(projectPath);
  const running = sessions.find((s) => s.status === "running");
  if (running) {
    console.log(pc.yellow(`Already running session: ${running.id}`));
    console.log(`Use ${pc.cyan("ralph-wiggum-cli stop")} to stop it first.`);
    return null;
  }

  // Resolve agent
  const modeConfig = config.agents[options.mode];
  const agentType = options.agentOverride || modeConfig.agent;
  const model = options.modelOverride || modeConfig.model;
  const agent = getAgent(agentType);

  // Check agent installed
  if (!(await agent.checkInstalled())) {
    console.log(pc.red(`${agent.name} is not installed.`));
    console.log(agent.getInstallInstructions());
    return null;
  }

  return { projectPath, config, agent, agentType, model };
}
