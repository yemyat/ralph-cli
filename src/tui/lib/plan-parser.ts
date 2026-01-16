// src/tui/lib/plan-parser.ts
// Pure function for parsing IMPLEMENTATION_PLAN.md content

import type { ParsedPlan, Task, TaskStatus } from "../types";

// Top-level regex patterns for performance (compiled once)
const SPEC_REFERENCE_REGEX = /^-\s*(?:\[.?\]\s*)?(specs\/[\w-]+\.md)/;
const STOPPED_MARKER_REGEX = /^-\s*\[stopped\]\s*(specs\/[\w-]+\.md)/;
const LEADING_NUMBERS_REGEX = /^\d+-/;

/**
 * Parse IMPLEMENTATION_PLAN.md content to extract tasks organized by status.
 * This is a pure function that takes content string and returns structured data.
 */
export function parseImplementationPlanContent(content: string): ParsedPlan {
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
 * Extract a readable name from a spec path.
 * Example: "specs/001-interactive-tui.md" -> "Interactive Tui"
 */
export function extractSpecName(specPath: string): string {
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
 * Detect section type from a trimmed line.
 * Returns the section status or null if not a section header.
 */
export function detectSection(trimmed: string): TaskStatus | null {
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
