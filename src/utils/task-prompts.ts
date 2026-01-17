// src/utils/task-prompts.ts
// Generate focused task prompts for task-level orchestration

import { PROMPT_BUILD } from "../templates/prompts";
import type { QualityGateResult, SpecEntry, TaskEntry } from "../types";
import { getCompletedTasks } from "./implementation";

/**
 * Format completed tasks as markdown checklist.
 */
function formatCompletedTasks(tasks: TaskEntry[]): string {
  if (tasks.length === 0) {
    return "_No tasks completed yet._";
  }
  return tasks.map((t) => `- [x] ${t.description}`).join("\n");
}

/**
 * Format acceptance criteria as markdown list.
 */
function formatAcceptanceCriteria(criteria: string[] | undefined): string {
  if (!criteria || criteria.length === 0) {
    return "_No specific acceptance criteria._";
  }
  return criteria.map((ac) => `- [ ] ${ac}`).join("\n");
}

/**
 * Generate a focused prompt for a single task.
 * This is injected when spawning an agent for one task.
 * Includes PROMPT_BUILD context at the top for rules and workflow.
 */
export function generateTaskPrompt(spec: SpecEntry, task: TaskEntry): string {
  const completedTasks = getCompletedTasks(spec);

  return `${PROMPT_BUILD}

---

# Task: ${task.description}

## Spec Context

You are working on: **${spec.name}**
${spec.context || "_No additional context provided._"}

## Completed Tasks

${formatCompletedTasks(completedTasks)}

## Your Assignment

Complete ONLY this task:

> ${task.description}

## Acceptance Criteria

${formatAcceptanceCriteria(task.acceptanceCriteria)}

## Rules

- Do NOT work on other tasks
- Do NOT commit (Ralph handles commits)
- Search codebase first — don't assume code is missing

## Completion

When done, output exactly: <TASK_DONE>
If blocked, output: <TASK_BLOCKED reason="...">
`;
}

/**
 * Generate a retry prompt that includes previous failure context.
 * Used when quality gates fail and we want to retry with error info.
 */
export function generateRetryPrompt(
  spec: SpecEntry,
  task: TaskEntry,
  failedGates: QualityGateResult[],
  previousAttempt: number
): string {
  const basePrompt = generateTaskPrompt(spec, task);

  const failureDetails = failedGates
    .map(
      (gate) =>
        `### ${gate.name} (exit code ${gate.exitCode})\n\`\`\`\n${truncateOutput(gate.output, 1000)}\n\`\`\``
    )
    .join("\n\n");

  return `${basePrompt}

---

## ⚠️ Previous Attempt Failed

This is retry attempt #${previousAttempt + 1}. The previous attempt failed quality gates:

${failureDetails}

Please fix the issues and complete the task.
`;
}

/**
 * Truncate output to a maximum length, keeping the most relevant parts.
 */
function truncateOutput(output: string, maxLength: number): string {
  if (output.length <= maxLength) {
    return output;
  }

  const halfLength = Math.floor(maxLength / 2) - 20;
  const start = output.slice(0, halfLength);
  const end = output.slice(-halfLength);

  return `${start}\n\n... (truncated ${output.length - maxLength} chars) ...\n\n${end}`;
}

/**
 * Generate a blocked task prompt for manual intervention.
 * When a task is blocked, this prompt helps the agent understand the issue.
 */
export function generateBlockedTaskPrompt(
  spec: SpecEntry,
  task: TaskEntry
): string {
  return `# Task Blocked: ${task.description}

## Spec: ${spec.name}

This task was previously blocked with the following reason:

> ${task.blockedReason || "No reason provided"}

## Options

1. If you can now resolve the blocker, fix the issue and output: <TASK_DONE>
2. If still blocked, output: <TASK_BLOCKED reason="...">
3. If the task should be skipped, output: <TASK_SKIP reason="...">

## Rules

- Focus only on resolving the blocker
- Search codebase first — don't assume code is missing
`;
}
