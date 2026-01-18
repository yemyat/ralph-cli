/**
 * Task result handlers.
 * Handle blocked, passed, failed, and error states for tasks.
 */

import pc from "picocolors";
import type {
  Implementation,
  QualityGateResult,
  SpecEntry,
  TaskEntry,
} from "../types";
import {
  markTaskBlocked,
  markTaskCompleted,
  markTaskFailed,
  resetTaskToPending,
  saveImplementation,
} from "../utils/implementation";
import { notifyTelegram } from "./notifications";
import type { GatesFailedOptions, LoopContext } from "./types";

/**
 * Handle a blocked task result.
 */
export async function handleBlockedTask(
  impl: Implementation,
  spec: SpecEntry,
  task: TaskEntry,
  reason: string | undefined,
  ctx: LoopContext
): Promise<void> {
  console.log(pc.yellow(`  ⚠ Task blocked: ${reason}`));
  ctx.log(`Task blocked: ${reason}`);
  markTaskBlocked(impl, spec.id, task.id, reason || "Unknown");
  await saveImplementation(ctx.projectPath, impl);
}

/**
 * Handle quality gates passed.
 */
export async function handleGatesPassed(
  impl: Implementation,
  spec: SpecEntry,
  task: TaskEntry,
  ctx: LoopContext
): Promise<void> {
  console.log(pc.green("  ✓ All quality gates passed"));
  ctx.log("All quality gates passed");
  markTaskCompleted(impl, spec.id, task.id);
  await saveImplementation(ctx.projectPath, impl);
  await notifyTelegram(
    ctx.config,
    ctx.session,
    "iteration_success",
    ctx.log,
    task.description
  );

  // Check if spec is complete
  const updatedSpec = impl.specs.find((s) => s.id === spec.id);
  if (updatedSpec?.status === "completed") {
    console.log(pc.green(`\n✓ Spec completed: ${spec.name}`));
    ctx.log(`Spec completed: ${spec.name}`);
  }
}

/**
 * Handle quality gates failed.
 */
export async function handleGatesFailed(
  impl: Implementation,
  spec: SpecEntry,
  task: TaskEntry,
  failedGates: QualityGateResult[],
  ctx: LoopContext,
  options: GatesFailedOptions
): Promise<void> {
  const retryCount = task.retryCount || 0;
  const { maxRetries, runRetryTask } = options;

  if (retryCount < maxRetries) {
    console.log(
      pc.yellow(
        `  ⚠ Quality gates failed (retry ${retryCount + 1}/${maxRetries})`
      )
    );
    ctx.log(`Quality gates failed, retrying (${retryCount + 1}/${maxRetries})`);

    markTaskFailed(impl, spec.id, task.id);
    resetTaskToPending(impl, spec.id, task.id);
    await saveImplementation(ctx.projectPath, impl);

    if (runRetryTask) {
      await runRetryTask(spec, task, failedGates, retryCount);
    }
  } else {
    console.log(pc.red("  ✗ Max retries exceeded for task"));
    ctx.log(`Max retries exceeded for task ${task.id}`);
    markTaskFailed(impl, spec.id, task.id);
    await saveImplementation(ctx.projectPath, impl);
    await notifyTelegram(
      ctx.config,
      ctx.session,
      "iteration_failure",
      ctx.log,
      task.description
    );
  }
}
