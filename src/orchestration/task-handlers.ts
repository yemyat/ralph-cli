/**
 * Task result handlers.
 * Handle blocked, passed, failed, and error states for tasks.
 */

import pc from "picocolors";
import type { Implementation } from "../domain";
import type { QualityGateResult } from "../types";
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
  const { task, reason } = options;
  console.log(pc.yellow(`  ⚠ Task blocked: ${reason}`));
  ctx.log(`Task blocked: ${reason}`);
  task.block(reason || "Unknown");
  await impl.save();
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
  task.complete();
  await impl.save();
  await notifyTelegram({
    config: ctx.config,
    session: ctx.session,
    status: "iteration_success",
    log: ctx.log,
    taskDescription: task.description,
  });

  // Check if spec is complete
  if (spec.isCompleted) {
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
  const currentRetryCount = task.retryCount;
  const { maxRetries, runRetryTask } = retryOptions;

  if (currentRetryCount < maxRetries) {
    console.log(
      pc.yellow(
        `  ⚠ Quality gates failed (retry ${currentRetryCount + 1}/${maxRetries})`
      )
    );
    ctx.log(
      `Quality gates failed, retrying (${currentRetryCount + 1}/${maxRetries})`
    );

    // retry() increments retryCount and sets status to pending
    task.retry();
    await impl.save();

    if (runRetryTask) {
      await runRetryTask(spec, task, failedGates, currentRetryCount);
    }
  } else {
    console.log(pc.red("  ✗ Max retries exceeded for task"));
    ctx.log(`Max retries exceeded for task ${task.id}`);
    task.fail();
    await impl.save();
    await notifyTelegram({
      config: ctx.config,
      session: ctx.session,
      status: "iteration_failure",
      log: ctx.log,
      taskDescription: task.description,
    });
  }
}
