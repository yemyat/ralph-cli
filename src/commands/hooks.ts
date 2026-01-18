import pc from "picocolors";
import type { BaseAgent } from "../agents/base";
import { getAgent } from "../agents/index";
import { Workspace } from "../domain/workspace";
import type { AgentType, RalphConfig, ResolveContextOptions } from "../types";

export interface CommandContext {
  config: RalphConfig;
  workspace: Workspace;
  agent: BaseAgent;
  agentType: AgentType;
  model?: string;
}

export async function resolveContext(
  options: ResolveContextOptions
): Promise<CommandContext | null> {
  const workspace = await Workspace.load();
  if (!workspace) {
    console.log(
      pc.red("Ralph is not initialized. Run `ralph-wiggum-cli init` first.")
    );
    return null;
  }

  const runningSession = workspace.sessionManager.running[0];
  if (runningSession) {
    console.log(pc.yellow(`Already running session: ${runningSession.id}`));
    console.log(`Use ${pc.cyan("ralph-wiggum-cli stop")} to stop it first.`);
    return null;
  }

  const config = workspace.config;
  const modeConfig = config.agents[options.mode];
  const agentType = options.agentOverride || modeConfig.agent;
  const model = options.modelOverride || modeConfig.model;
  const agent = getAgent(agentType);

  if (!(await agent.checkInstalled())) {
    console.log(pc.red(`${agent.name} is not installed.`));
    console.log(agent.getInstallInstructions());
    return null;
  }

  return {
    config,
    workspace,
    agent,
    agentType,
    model,
  };
}
