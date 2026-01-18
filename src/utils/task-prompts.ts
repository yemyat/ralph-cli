import { MARKERS } from "../constants";
import { PROMPT_BUILD } from "../templates/prompts";
import type { SpecLike, TaskLike } from "../types";

/**
 * Get completed tasks from a spec-like object.
 */
function getCompletedTasks(spec: SpecLike): TaskLike[] {
  return spec.tasks.filter((t) => t.status === "completed");
}

/**
 * Format completed tasks as markdown checklist.
 */
function formatCompletedTasks(tasks: readonly TaskLike[]): string {
  if (tasks.length === 0) {
    return "_No tasks completed yet._";
  }
  return tasks.map((t) => `- [x] ${t.description}`).join("\n");
}

/**
 * Format acceptance criteria as markdown list.
 */
function formatAcceptanceCriteria(
  criteria: readonly string[] | undefined
): string {
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
export function generateTaskPrompt(spec: SpecLike, task: TaskLike): string {
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

When done, output exactly: ${MARKERS.TASK_DONE}
If blocked, output: ${MARKERS.TASK_BLOCKED_TEMPLATE}
`;
}

/**
 * Generate a blocked task prompt for manual intervention.
 * When a task is blocked, this prompt helps the agent understand the issue.
 */
export function generateBlockedTaskPrompt(
  spec: SpecLike,
  task: TaskLike
): string {
  return `# Task Blocked: ${task.description}

## Spec: ${spec.name}

This task was previously blocked with the following reason:

> ${task.blockedReason || "No reason provided"}

## Options

1. If you can now resolve the blocker, fix the issue and output: ${MARKERS.TASK_DONE}
2. If still blocked, output: ${MARKERS.TASK_BLOCKED_TEMPLATE}
3. If the task should be skipped, output: <TASK_SKIP reason="...">

## Rules

- Focus only on resolving the blocker
- Search codebase first — don't assume code is missing
`;
}
