import pc from "picocolors";
import type { HookListener, HookPayload } from "../types";

export class ConsoleListener implements HookListener {
  onLoopStarted(payload: HookPayload): void {
    const modeLabel = payload.mode === "plan" ? "plan mode" : "build loop";
    console.log(pc.green(`\n🚀 Starting Ralph ${modeLabel}...\n`));
    console.log(`  Session: ${pc.cyan(payload.sessionId)}`);
    console.log(`  Agent:   ${pc.cyan(payload.agent)}`);
    console.log(`  Model:   ${pc.cyan(payload.model || "default")}`);
    if (payload.promptFile) {
      console.log(`  Prompt:  ${pc.cyan(payload.promptFile)}`);
    }
    if (payload.logFile) {
      console.log(`  Log:     ${pc.gray(payload.logFile)}`);
    }
    console.log(pc.gray("\nPress Ctrl+C to stop.\n"));
  }

  onIterationStarted(payload: HookPayload): void {
    console.log(
      pc.cyan(`\n📋 Task ${payload.iteration}: ${payload.taskDescription}`)
    );
    if (payload.specName) {
      console.log(pc.gray(`   Spec: ${payload.specName}`));
    }
    if (payload.logFile) {
      console.log(pc.gray(`   Log:  ${payload.logFile}`));
    }
  }

  onIterationSuccess(_payload: HookPayload): void {
    console.log(pc.green("  ✓ Task completed"));
  }

  onIterationFailure(_payload: HookPayload): void {
    console.log(pc.red("  ✗ Task failed"));
  }

  onTaskBlocked(payload: HookPayload): void {
    console.log(pc.yellow(`  ⚠ Task blocked: ${payload.taskDescription}`));
  }

  onSpecCompleted(payload: HookPayload): void {
    console.log(pc.green(`\n✓ Spec completed: ${payload.specName}`));
  }

  onLoopCompleted(payload: HookPayload): void {
    if (payload.mode === "build") {
      console.log(pc.green("\n✓ All tasks completed!"));
    } else {
      console.log(pc.green("\n✓ Plan mode completed"));
    }
  }

  onLoopStopped(_payload: HookPayload): void {
    console.log(pc.yellow("\n\nStopping Ralph loop..."));
  }
}
