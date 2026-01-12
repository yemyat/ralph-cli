import type { AgentType } from "../types.js";
import { AmpAgent } from "./amp.js";
import type { BaseAgent } from "./base.js";
import { ClaudeAgent } from "./claude.js";
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

// Re-export agent classes for direct usage by consumers and tests
// biome-ignore lint/performance/noBarrelFile: This is a legitimate barrel file for the agents module
export { AmpAgent } from "./amp.js";
export { BaseAgent } from "./base.js";
export { ClaudeAgent } from "./claude.js";
export { DroidAgent } from "./droid.js";
