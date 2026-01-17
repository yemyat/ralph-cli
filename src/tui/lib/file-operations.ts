// src/tui/lib/file-operations.ts
// File I/O utilities for TUI

import { join } from "node:path";
import fse from "fs-extra";
import type { SpecEntry } from "../../types";
import {
  parseImplementation,
  saveImplementation,
} from "../../utils/implementation";
import { getLogsDir, getRalphDir, getSpecsDir } from "../../utils/paths";
import type { ParsedPlan, Task, TaskStatus } from "../types";

// Top-level regex for lint compliance
const LEADING_NUMBERS_REGEX = /^\d+-/;

/**
 * Convert a spec filename to a readable title.
 * Example: "011-telegram-notifications" -> "Telegram Notifications"
 */
function specIdToName(specId: string): string {
  // Remove leading numbers (e.g., "011-")
  const withoutNumbers = specId.replace(LEADING_NUMBERS_REGEX, "");
  // Convert kebab-case to Title Case
  return withoutNumbers
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Map spec status to TUI task status.
 */
function mapSpecStatusToTaskStatus(specStatus: string): TaskStatus {
  switch (specStatus) {
    case "in_progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "blocked":
      return "stopped";
    default:
      return "backlog";
  }
}

/**
 * Convert SpecEntry to TUI Task format.
 */
function specToTask(spec: SpecEntry): Task {
  return {
    id: spec.file,
    name: spec.name || specIdToName(spec.id),
    specPath: spec.file,
    status: mapSpecStatusToTaskStatus(spec.status),
  };
}

/**
 * Parse implementation.json from the project path.
 * Returns a ParsedPlan structure for TUI consumption.
 */
export async function parseImplementationPlan(
  projectPath: string
): Promise<ParsedPlan> {
  const impl = await parseImplementation(projectPath);

  if (!impl) {
    return { inProgress: [], backlog: [], completed: [], stopped: [] };
  }

  const result: ParsedPlan = {
    inProgress: [],
    backlog: [],
    completed: [],
    stopped: [],
  };

  for (const spec of impl.specs) {
    const task = specToTask(spec);
    switch (task.status) {
      case "in_progress":
        result.inProgress.push(task);
        break;
      case "completed":
        result.completed.push(task);
        break;
      case "stopped":
        result.stopped.push(task);
        break;
      default:
        result.backlog.push(task);
        break;
    }
  }

  return result;
}

/**
 * Read spec file content from the project.
 * Returns the raw markdown content or a "not found" message.
 */
export async function readSpecContent(
  projectPath: string,
  specPath: string
): Promise<string> {
  const fullPath = join(getRalphDir(projectPath), specPath);

  if (!(await fse.pathExists(fullPath))) {
    return `# Spec Not Found\n\nThe spec file \`${specPath}\` does not exist.`;
  }

  return fse.readFile(fullPath, "utf-8");
}

/**
 * Get all spec files from the specs directory.
 * Returns array of relative spec paths (e.g., ["specs/001-feature.md"])
 */
export async function getAllSpecs(projectPath: string): Promise<string[]> {
  const specsDir = getSpecsDir(projectPath);

  if (!(await fse.pathExists(specsDir))) {
    return [];
  }

  const files = await fse.readdir(specsDir);
  return files.filter((f) => f.endsWith(".md")).map((f) => `specs/${f}`);
}

/**
 * Get the most recent log file path for a project.
 * Returns null if no logs exist.
 */
export async function getLatestSessionLog(
  projectPath: string
): Promise<string | null> {
  const logsDir = getLogsDir(projectPath);

  if (!(await fse.pathExists(logsDir))) {
    return null;
  }

  const files = await fse.readdir(logsDir);
  const logFiles = files.filter((f) => f.endsWith(".log"));

  if (logFiles.length === 0) {
    return null;
  }

  // Get the most recent log file by stat
  const stats = await Promise.all(
    logFiles.map(async (f) => ({
      file: f,
      stat: await fse.stat(join(logsDir, f)),
    }))
  );

  stats.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
  return join(logsDir, stats[0].file);
}

/**
 * Read log file content (tail).
 * Returns the last N lines of the log file.
 */
export async function readLogContent(
  logPath: string,
  lines = 50
): Promise<string> {
  if (!(await fse.pathExists(logPath))) {
    return "No log file found.";
  }

  const content = await fse.readFile(logPath, "utf-8");
  const allLines = content.split("\n");
  return allLines.slice(-lines).join("\n");
}

/**
 * Append a timestamped message to a log file.
 */
export async function appendToLog(
  logPath: string,
  message: string
): Promise<void> {
  if (!logPath) {
    return;
  }

  const timestamp = new Date().toISOString();
  const logEntry = `\n[${timestamp}] ${message}\n`;

  try {
    await fse.appendFile(logPath, logEntry);
  } catch {
    // Ignore errors when appending to log
  }
}

/**
 * Mark a spec as stopped/blocked in implementation.json.
 * Updates the status of the spec with matching file path.
 */
export async function markTaskAsStopped(
  projectPath: string,
  specPath: string
): Promise<void> {
  const impl = await parseImplementation(projectPath);

  if (!impl) {
    return;
  }

  // Find the spec by file path
  const spec = impl.specs.find((s) => s.file === specPath);
  if (!spec) {
    return;
  }

  // Mark spec as blocked (stopped in TUI terminology)
  spec.status = "blocked";

  // Save the updated implementation
  await saveImplementation(projectPath, impl, "user");
}
