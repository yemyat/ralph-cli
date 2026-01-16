import type { AgentType } from "../types";
import { AmpAgent } from "./amp";
import type { BaseAgent } from "./base";
import { ClaudeAgent } from "./claude";
import { CodexAgent } from "./codex";
import { CursorAgent } from "./cursor";
import { DroidAgent } from "./droid";
import { GeminiAgent } from "./gemini";
import { OpenCodeAgent } from "./opencode";

const agents: Record<AgentType, BaseAgent> = {
  claude: new ClaudeAgent(),
  amp: new AmpAgent(),
  droid: new DroidAgent(),
  opencode: new OpenCodeAgent(),
  cursor: new CursorAgent(),
  codex: new CodexAgent(),
  gemini: new GeminiAgent(),
};

export function getAgent(type: AgentType): BaseAgent {
  return agents[type];
}

export function getAllAgents(): BaseAgent[] {
  return Object.values(agents);
}

// Re-export agent classes for direct usage by consumers and tests
// biome-ignore lint/performance/noBarrelFile: This is a legitimate barrel file for the agents module
export { AmpAgent } from "./amp";
export { BaseAgent } from "./base";
export { ClaudeAgent } from "./claude";
export { CodexAgent } from "./codex";
export { CursorAgent } from "./cursor";
export { DroidAgent } from "./droid";
export { GeminiAgent } from "./gemini";
export { OpenCodeAgent } from "./opencode";
