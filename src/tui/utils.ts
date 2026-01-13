import { join } from "node:path";
import fse from "fs-extra";
import { getLogsDir, getRalphDir, getSpecsDir } from "../utils/paths.js";

// Top-level regex patterns for performance
const SPEC_REFERENCE_REGEX = /^-\s*(?:\[.?\]\s*)?(specs\/[\w-]+\.md)/;
const LEADING_NUMBERS_REGEX = /^\d+-/;

export type TaskStatus = "backlog" | "in_progress" | "completed" | "stopped";

export interface Task {
  id: string;
  name: string;
  specPath: string;
  status: TaskStatus;
}

export interface ParsedPlan {
  inProgress: Task[];
  backlog: Task[];
  completed: Task[];
  stopped: Task[];
}

/**
 * Parse IMPLEMENTATION_PLAN.md to extract tasks organized by status
 */
// Regex to detect stopped marker: - [stopped] specs/...
const STOPPED_MARKER_REGEX = /^-\s*\[stopped\]\s*(specs\/[\w-]+\.md)/;

export async function parseImplementationPlan(
  projectPath: string
): Promise<ParsedPlan> {
  const planPath = join(getRalphDir(projectPath), "IMPLEMENTATION_PLAN.md");

  if (!(await fse.pathExists(planPath))) {
    return { inProgress: [], backlog: [], completed: [], stopped: [] };
  }

  const content = await fse.readFile(planPath, "utf-8");
  const lines = content.split("\n");

  const result: ParsedPlan = {
    inProgress: [],
    backlog: [],
    completed: [],
    stopped: [],
  };

  let currentSection: TaskStatus | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    if (trimmed.startsWith("## In Progress")) {
      currentSection = "in_progress";
      continue;
    }
    if (trimmed.startsWith("## Backlog")) {
      currentSection = "backlog";
      continue;
    }
    if (trimmed.startsWith("## Completed")) {
      currentSection = "completed";
      continue;
    }

    // Skip if not in a section or line is empty/comment
    if (!(currentSection && trimmed) || trimmed.startsWith("<!--")) {
      continue;
    }

    // Check for stopped marker first (e.g., "- [stopped] specs/...")
    const stoppedMatch = trimmed.match(STOPPED_MARKER_REGEX);
    if (stoppedMatch) {
      const specPath = stoppedMatch[1];
      const name = extractSpecName(specPath);
      const task: Task = {
        id: specPath,
        name,
        specPath,
        status: "stopped",
      };
      result.stopped.push(task);
      continue;
    }

    // Parse spec references (e.g., "- specs/001-feature.md" or "- [x] specs/...")
    const specMatch = trimmed.match(SPEC_REFERENCE_REGEX);
    if (specMatch) {
      const specPath = specMatch[1];
      const name = extractSpecName(specPath);
      const task: Task = {
        id: specPath,
        name,
        specPath,
        status: currentSection,
      };

      switch (currentSection) {
        case "in_progress":
          result.inProgress.push(task);
          break;
        case "backlog":
          result.backlog.push(task);
          break;
        case "completed":
          result.completed.push(task);
          break;
        default:
          // Exhaustive check - all cases handled
          break;
      }
    }
  }

  return result;
}

/**
 * Extract a readable name from a spec path
 */
function extractSpecName(specPath: string): string {
  // specs/001-interactive-tui.md -> Interactive TUI
  const filename = specPath.replace("specs/", "").replace(".md", "");
  // Remove leading numbers
  const withoutNumbers = filename.replace(LEADING_NUMBERS_REGEX, "");
  // Convert kebab-case to Title Case
  return withoutNumbers
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Read spec file content
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
 * Get all spec files from the specs directory
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
 * Get log file path for a session
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
 * Read log file content (tail)
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

// Helper to detect section from line
function detectSection(trimmed: string): string | null {
  if (trimmed.startsWith("## In Progress")) {
    return "in_progress";
  }
  if (trimmed.startsWith("## Backlog")) {
    return "backlog";
  }
  if (trimmed.startsWith("## Completed")) {
    return "completed";
  }
  return null;
}

// Helper to find task and backlog positions
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

    if (currentSection === "in_progress" && trimmed.includes(specPath)) {
      taskLineIndex = i;
      break;
    }
  }

  return { taskLineIndex, backlogIndex };
}

// Helper to find insertion index in backlog
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
 * Move a task from In Progress to Backlog with [stopped] marker
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

/**
 * Append a termination message to the log file
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
