import type { AgentType } from "../types.js";
import { BaseAgent } from "./base.js";
import { ClaudeAgent } from "./claude.js";
import { AmpAgent } from "./amp.js";
import { DroidAgent } from "./droid.js";

const agents: Record<AgentType, BaseAgent> = {
  claude: new ClaudeAgent(),
  amp: new AmpAgent(),
  droid: new DroidAgent(),
};

export function getAgent(type: AgentType): BaseAgent {
  return agents[type];
}

export function getAllAgents(): BaseAgent[] {
  return Object.values(agents);
}

export { BaseAgent, ClaudeAgent, AmpAgent, DroidAgent };
