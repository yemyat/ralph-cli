import { join } from "node:path";

export const RALPH_DIR_NAME = ".ralph-wiggum";
export const RALPH_CONFIG_FILE = "config.json";
export const RALPH_LOGS_DIR = "logs";
export const IMPLEMENTATION_FILE = "implementation.json";

export function getRalphDir(): string {
  return join(process.cwd(), RALPH_DIR_NAME);
}

export function getConfigFile(): string {
  return join(getRalphDir(), RALPH_CONFIG_FILE);
}

export function getLogsDir(): string {
  return join(getRalphDir(), RALPH_LOGS_DIR);
}

export function getSessionLogFile(sessionId: string): string {
  return join(getLogsDir(), `${sessionId}.log`);
}

export function getSpecsDir(): string {
  return join(getRalphDir(), "specs");
}

export function getImplementationFile(): string {
  return join(getRalphDir(), IMPLEMENTATION_FILE);
}
