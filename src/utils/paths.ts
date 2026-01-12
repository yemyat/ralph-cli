import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

export const RALPH_HOME = join(homedir(), ".ralph");
export const RALPH_CONFIG_FILE = join(RALPH_HOME, "config.json");
export const RALPH_PROJECTS_DIR = join(RALPH_HOME, "projects");
export const RALPH_LOGS_DIR = join(RALPH_HOME, "logs");

export function getProjectId(projectPath: string): string {
  return createHash("sha256").update(projectPath).digest("hex").slice(0, 12);
}

export function getProjectDir(projectId: string): string {
  return join(RALPH_PROJECTS_DIR, projectId);
}

export function getSessionLogFile(sessionId: string): string {
  return join(RALPH_LOGS_DIR, `${sessionId}.log`);
}
