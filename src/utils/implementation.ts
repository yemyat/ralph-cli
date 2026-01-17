// src/utils/implementation.ts
// Utilities for managing implementation.json - task-level orchestration

import fse from "fs-extra";
import type { Implementation, SpecEntry, TaskEntry } from "../types";
import { getImplementationFile } from "./paths";

/**
 * Create an empty implementation structure.
 */
export function createEmptyImplementation(): Implementation {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "user",
    specs: [],
    qualityGates: [
      "bun run typecheck",
      "bun run lint",
      "bun run test",
      "bun run build",
    ],
  };
}

/**
 * Load implementation.json from project path.
 * Returns null if file doesn't exist.
 */
export async function parseImplementation(
  projectPath: string
): Promise<Implementation | null> {
  const implPath = getImplementationFile(projectPath);

  if (!(await fse.pathExists(implPath))) {
    return null;
  }

  try {
    const content = await fse.readJson(implPath);
    return content as Implementation;
  } catch {
    return null;
  }
}

/**
 * Save implementation.json to project path.
 * Updates the timestamp and writes with pretty formatting.
 */
export async function saveImplementation(
  projectPath: string,
  impl: Implementation,
  updatedBy: "plan-mode" | "build-mode" | "user" = "build-mode"
): Promise<void> {
  const implPath = getImplementationFile(projectPath);

  impl.updatedAt = new Date().toISOString();
  impl.updatedBy = updatedBy;

  await fse.writeJson(implPath, impl, { spaces: 2 });
}

/**
 * Get the next pending task from the implementation.
 * Finds the first pending task in the first in_progress spec.
 * If no in_progress spec, promotes the first pending spec to in_progress.
 */
export function getNextPendingTask(
  impl: Implementation
): { spec: SpecEntry; task: TaskEntry } | null {
  // First, look for an in_progress spec
  let activeSpec = impl.specs.find((s) => s.status === "in_progress");

  // If no in_progress spec, find first pending spec and promote it
  if (!activeSpec) {
    activeSpec = impl.specs.find((s) => s.status === "pending");
    if (activeSpec) {
      activeSpec.status = "in_progress";
    }
  }

  if (!activeSpec) {
    return null;
  }

  // Find the first pending task in the active spec
  const pendingTask = activeSpec.tasks.find((t) => t.status === "pending");

  if (!pendingTask) {
    // No pending tasks in this spec - check if all are done
    const allCompleted = activeSpec.tasks.every(
      (t) => t.status === "completed"
    );
    if (allCompleted) {
      activeSpec.status = "completed";
      // Recursively find next task from remaining specs
      return getNextPendingTask(impl);
    }
    return null;
  }

  return { spec: activeSpec, task: pendingTask };
}

/**
 * Mark a task as in_progress.
 */
export function markTaskInProgress(
  impl: Implementation,
  specId: string,
  taskId: string
): void {
  const spec = impl.specs.find((s) => s.id === specId);
  if (!spec) {
    return;
  }

  const task = spec.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "in_progress";
  }
}

/**
 * Mark a task as completed.
 */
export function markTaskCompleted(
  impl: Implementation,
  specId: string,
  taskId: string
): void {
  const spec = impl.specs.find((s) => s.id === specId);
  if (!spec) {
    return;
  }

  const task = spec.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "completed";
    task.completedAt = new Date().toISOString();
  }

  // Check if all tasks in spec are completed
  const allCompleted = spec.tasks.every((t) => t.status === "completed");
  if (allCompleted) {
    spec.status = "completed";
  }
}

/**
 * Mark a task as failed with retry count increment.
 */
export function markTaskFailed(
  impl: Implementation,
  specId: string,
  taskId: string
): void {
  const spec = impl.specs.find((s) => s.id === specId);
  if (!spec) {
    return;
  }

  const task = spec.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "failed";
    task.retryCount = (task.retryCount || 0) + 1;
  }
}

/**
 * Mark a task as blocked with reason.
 */
export function markTaskBlocked(
  impl: Implementation,
  specId: string,
  taskId: string,
  reason: string
): void {
  const spec = impl.specs.find((s) => s.id === specId);
  if (!spec) {
    return;
  }

  const task = spec.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "blocked";
    task.blockedReason = reason;
  }
}

/**
 * Reset a failed/blocked task to pending for retry.
 */
export function resetTaskToPending(
  impl: Implementation,
  specId: string,
  taskId: string
): void {
  const spec = impl.specs.find((s) => s.id === specId);
  if (!spec) {
    return;
  }

  const task = spec.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "pending";
  }
}

/**
 * Get completed tasks for a spec (for context in prompts).
 */
export function getCompletedTasks(spec: SpecEntry): TaskEntry[] {
  return spec.tasks.filter((t) => t.status === "completed");
}

/**
 * Calculate overall progress for a spec.
 */
export function getSpecProgress(spec: SpecEntry): {
  completed: number;
  total: number;
  percentage: number;
} {
  const completed = spec.tasks.filter((t) => t.status === "completed").length;
  const total = spec.tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percentage };
}

/**
 * Get overall implementation progress.
 */
export function getImplementationProgress(impl: Implementation): {
  completedSpecs: number;
  totalSpecs: number;
  completedTasks: number;
  totalTasks: number;
} {
  const completedSpecs = impl.specs.filter(
    (s) => s.status === "completed"
  ).length;
  const totalSpecs = impl.specs.length;

  let completedTasks = 0;
  let totalTasks = 0;

  for (const spec of impl.specs) {
    totalTasks += spec.tasks.length;
    completedTasks += spec.tasks.filter((t) => t.status === "completed").length;
  }

  return { completedSpecs, totalSpecs, completedTasks, totalTasks };
}

/**
 * Get the current spec ID from implementation.json.
 * Returns the in_progress spec ID, or first pending spec ID if none in progress.
 */
export async function getCurrentSpecId(
  projectPath: string
): Promise<string | null> {
  const impl = await parseImplementation(projectPath);
  if (!impl) {
    return null;
  }

  // First look for in_progress spec
  const inProgress = impl.specs.find((s) => s.status === "in_progress");
  if (inProgress) {
    return inProgress.id;
  }

  // Then look for first pending spec
  const pending = impl.specs.find((s) => s.status === "pending");
  if (pending) {
    return pending.id;
  }

  return null;
}
