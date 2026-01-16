// src/tui/lib/file-operations.ts
// File I/O utilities for TUI

import { join } from "node:path";
import fse from "fs-extra";
import { getLogsDir, getRalphDir, getSpecsDir } from "../../utils/paths";
import type { ParsedPlan } from "../types";
import { detectSection, parseImplementationPlanContent } from "./plan-parser";

/**
 * Parse IMPLEMENTATION_PLAN.md from the project path.
 * Combines file I/O with pure parsing logic.
 */
export async function parseImplementationPlan(
  projectPath: string
): Promise<ParsedPlan> {
  const planPath = join(getRalphDir(projectPath), "IMPLEMENTATION_PLAN.md");

  if (!(await fse.pathExists(planPath))) {
    return { inProgress: [], backlog: [], completed: [], stopped: [] };
  }

  const content = await fse.readFile(planPath, "utf-8");
  return parseImplementationPlanContent(content);
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

// Helper: find task and backlog positions in lines
function findTaskAndBacklogPositions(
  lines: string[],
  specPath: string
): { taskLineIndex: number; backlogIndex: number } {
  let currentSection: string | null = null;
  let backlogIndex = -1;
  let taskLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const section = detectSection(trimmed);

    if (section) {
      currentSection = section;
      if (section === "backlog") {
        backlogIndex = i;
      }
      continue;
    }

    // Only look for task in in_progress section, but continue scanning for backlog
    if (
      taskLineIndex === -1 &&
      currentSection === "in_progress" &&
      trimmed.includes(specPath)
    ) {
      taskLineIndex = i;
    }
  }

  return { taskLineIndex, backlogIndex };
}

// Helper: find insertion index in backlog (after header and comments)
function findBacklogInsertIndex(lines: string[], startIndex: number): number {
  let insertIndex = startIndex;
  while (insertIndex < lines.length) {
    const line = lines[insertIndex].trim();
    const isCommentOrEmpty = line.startsWith("<!--") || line === "";
    if (isCommentOrEmpty) {
      insertIndex++;
    } else {
      break;
    }
  }
  return insertIndex;
}

/**
 * Move a task from In Progress to Backlog with [stopped] marker.
 * Updates the IMPLEMENTATION_PLAN.md file in place.
 */
export async function markTaskAsStopped(
  projectPath: string,
  specPath: string
): Promise<void> {
  const planPath = join(getRalphDir(projectPath), "IMPLEMENTATION_PLAN.md");

  if (!(await fse.pathExists(planPath))) {
    return;
  }

  const content = await fse.readFile(planPath, "utf-8");
  const lines = content.split("\n");

  const { taskLineIndex, backlogIndex } = findTaskAndBacklogPositions(
    lines,
    specPath
  );

  // If task not found or backlog section not found, return
  if (taskLineIndex === -1 || backlogIndex === -1) {
    return;
  }

  // Remove task from In Progress
  lines.splice(taskLineIndex, 1);

  // Find the first line after backlog header to insert (accounting for removal)
  const adjustedBacklogIndex =
    backlogIndex > taskLineIndex ? backlogIndex - 1 : backlogIndex;

  // Create the stopped task line with marker
  const stoppedLine = `- [stopped] ${specPath}`;

  // Find where to insert in backlog (after header and any comments)
  const insertIndex = findBacklogInsertIndex(lines, adjustedBacklogIndex + 1);

  // Insert the stopped task at the beginning of backlog
  lines.splice(insertIndex, 0, stoppedLine);

  // Write back to file
  await fse.writeFile(planPath, lines.join("\n"));
}
