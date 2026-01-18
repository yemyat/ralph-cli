/**
 * Centralized constants for Ralph CLI.
 * Eliminates magic strings scattered across the codebase.
 */

/**
 * Task completion markers used by agents to signal task status.
 */
export const MARKERS = {
  /** Marker output by agent when task is complete */
  TASK_DONE: "<TASK_DONE>",

  /** Template for blocked marker (for documentation/prompts) */
  TASK_BLOCKED_TEMPLATE: '<TASK_BLOCKED reason="...">',

  /** Regex pattern to parse blocked marker and extract reason */
  TASK_BLOCKED_REGEX: /<TASK_BLOCKED\s+reason="([^"]+)">/,
} as const;

/**
 * Standard file names used in the .ralph-wiggum/ directory.
 */
export const FILES = {
  /** Project configuration file */
  CONFIG: "config.json",

  /** Implementation plan and task tracking */
  IMPLEMENTATION: "implementation.json",

  /** Planning mode prompt template */
  PROMPT_PLAN: "PROMPT_plan.md",
} as const;

/**
 * Default configuration values for Ralph CLI.
 */
export const DEFAULTS = {
  /** Maximum retry attempts for failed tasks */
  MAX_RETRIES: 3,

  /** Timeout in ms for graceful shutdown */
  GRACEFUL_SHUTDOWN_MS: 5000,

  /** Default agent to use when not specified */
  DEFAULT_AGENT: "claude",
} as const;

/**
 * Formats a blocked marker with the given reason.
 * @param reason - The reason why the task is blocked
 * @returns The formatted blocked marker string
 */
export function formatBlockedMarker(reason: string): string {
  return `<TASK_BLOCKED reason="${reason}">`;
}

/**
 * Parses a blocked marker from agent output and extracts the reason.
 * @param output - The agent output to parse
 * @returns The extracted reason, or null if no blocked marker found
 */
export function parseBlockedMarker(output: string): string | null {
  const match = output.match(MARKERS.TASK_BLOCKED_REGEX);
  return match ? match[1] : null;
}
