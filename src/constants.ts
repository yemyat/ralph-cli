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
