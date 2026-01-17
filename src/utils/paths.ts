import { join } from "node:path";

export const RALPH_DIR_NAME = ".ralph-wiggum";
export const RALPH_CONFIG_FILE = "config.json";
export const RALPH_LOGS_DIR = "logs";

export function getRalphDir(projectPath: string): string {
  return join(projectPath, RALPH_DIR_NAME);
}

export function getConfigFile(projectPath: string): string {
  return join(getRalphDir(projectPath), RALPH_CONFIG_FILE);
}

export function getLogsDir(projectPath: string): string {
  return join(getRalphDir(projectPath), RALPH_LOGS_DIR);
}

export function getSessionLogFile(
  projectPath: string,
  sessionId: string
): string {
  return join(getLogsDir(projectPath), `${sessionId}.log`);
}

export function getSpecsDir(projectPath: string): string {
  return join(getRalphDir(projectPath), "specs");
}

export const IMPLEMENTATION_FILE = "implementation.json";

export function getImplementationFile(projectPath: string): string {
  return join(getRalphDir(projectPath), IMPLEMENTATION_FILE);
}
