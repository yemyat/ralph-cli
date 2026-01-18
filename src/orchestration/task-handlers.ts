/**
 * Task result handlers.
 * Handle blocked, passed, failed, and error states for tasks.
 */

import pc from "picocolors";
import type { Implementation, QualityGateResult } from "../types";
import {
  markTaskBlocked,
  markTaskCompleted,
  markTaskFailed,
  resetTaskToPending,
  saveImplementation,
} from "../utils/implementation";
import { notifyTelegram } from "./notifications";
import type {
  BlockedTaskOptions,
  GatesFailedOptions,
  LoopContext,
  TaskContext,
} from "./types";

/**
 * Handle a blocked task result.
 */
export async function handleBlockedTask(
  impl: Implementation,
  ctx: LoopContext,
  options: BlockedTaskOptions
): Promise<void> {
  const { spec, task, reason } = options;
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
  ctx: LoopContext,
  taskCtx: TaskContext
): Promise<void> {
  const { spec, task } = taskCtx;
  console.log(pc.green("  ✓ All quality gates passed"));
  ctx.log("All quality gates passed");
  markTaskCompleted(impl, spec.id, task.id);
  await saveImplementation(ctx.projectPath, impl);
  await notifyTelegram({
    config: ctx.config,
    session: ctx.session,
    status: "iteration_success",
    log: ctx.log,
    taskDescription: task.description,
  });

  // Check if spec is complete
  const updatedSpec = impl.specs.find((s) => s.id === spec.id);
  if (updatedSpec?.status === "completed") {
    console.log(pc.green(`\n✓ Spec completed: ${spec.name}`));
    ctx.log(`Spec completed: ${spec.name}`);
  }
}

/**
 * Options for handleGatesFailed.
 */
interface GatesFailedHandlerOptions {
  taskCtx: TaskContext;
  failedGates: QualityGateResult[];
  retryOptions: GatesFailedOptions;
}

/**
 * Handle quality gates failed.
 */
export async function handleGatesFailed(
  impl: Implementation,
  ctx: LoopContext,
  options: GatesFailedHandlerOptions
): Promise<void> {
  const { taskCtx, failedGates, retryOptions } = options;
  const { spec, task } = taskCtx;
  const retryCount = task.retryCount || 0;
  const { maxRetries, runRetryTask } = retryOptions;

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
    await notifyTelegram({
      config: ctx.config,
      session: ctx.session,
      status: "iteration_failure",
      log: ctx.log,
      taskDescription: task.description,
    });
  }
}
