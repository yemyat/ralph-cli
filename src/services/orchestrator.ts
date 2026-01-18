import type { ChildProcess } from "node:child_process";
import fse from "fs-extra";
import Mustache from "mustache";
import pc from "picocolors";
import type { BaseAgent } from "../agents/base";
import { Implementation } from "../domain/implementation";
import type { Session } from "../domain/session";
import type { Workspace } from "../domain/workspace";
import { PROMPT_BUILD } from "../templates/prompts";
import type {
  OrchestratorOptions,
  RalphConfig,
  SpecLike,
  TaskLike,
} from "../types";
import { AgentRunner } from "./agent-runner";
import { NotificationService } from "./notification-service";

function generateTaskPrompt(spec: SpecLike, task: TaskLike): string {
  const acceptanceCriteria = task.acceptanceCriteria?.length
    ? task.acceptanceCriteria.map((ac) => `- [ ] ${ac}`).join("\n")
    : "_No specific acceptance criteria._";

  return Mustache.render(PROMPT_BUILD, {
    spec_name: spec.name,
    full_specs_file: spec.file,
    task_context: task.description,
    acceptance_criteria: acceptanceCriteria,
  });
}

export class Orchestrator {
  private readonly config: RalphConfig;
  private readonly workspace: Workspace;
  private readonly session: Session;
  private readonly logFile: string;
  private readonly agent: BaseAgent;
  private readonly verbose: boolean;

  private logStream: fse.WriteStream | null = null;
  private currentChild: ChildProcess | null = null;
  private agentRunner: AgentRunner | null = null;
  private notificationService: NotificationService | null = null;

  constructor(options: OrchestratorOptions) {
    this.config = options.config;
    this.workspace = options.workspace;
    this.session = options.session;
    this.logFile = options.logFile;
    this.agent = options.agent;
    this.verbose = options.verbose ?? false;
  }

  private log(msg: string): void {
    const timestamp = new Date().toISOString();
    this.logStream?.write(`[${timestamp}] ${msg}\n`);
    if (this.verbose) {
      console.log(pc.gray(`[${timestamp}]`), msg);
    }
  }

  private setupServices(): void {
    this.logStream = fse.createWriteStream(this.logFile, { flags: "a" });

    this.agentRunner = new AgentRunner({
      agent: this.agent,
      model: this.session.model,
      verbose: this.verbose,
      log: (msg) => this.log(msg),
    });

    this.notificationService = new NotificationService({
      config: this.config.notifications,
      context: {
        projectName: this.config.projectName,
        mode: this.session.mode,
        sessionId: this.session.id,
      },
      log: (msg) => this.log(msg),
    });
  }

  private setupSignalHandlers(): void {
    const handleSignal = async () => {
      console.log(pc.yellow("\n\nStopping Ralph loop..."));
      if (this.currentChild && !this.currentChild.killed) {
        this.currentChild.kill("SIGTERM");
        console.log(pc.gray("Terminated agent process"));
      }
      this.session.markStopped();
      this.workspace.sessionManager.update(this.session);
      await this.workspace.save();
      this.log("Loop stopped by user");
      await this.notificationService?.notify(
        "loop_stopped",
        this.session.iteration
      );
      this.logStream?.close();
      process.exit(0);
    };

    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);
  }

  private async updateSessionState(): Promise<void> {
    this.workspace.sessionManager.update(this.session);
    await this.workspace.save();
  }

  async run(): Promise<void> {
    this.setupServices();
    this.setupSignalHandlers();

    this.log(`Starting build loop - Session ${this.session.id}`);
    await this.notificationService?.notify(
      "loop_started",
      this.session.iteration
    );

    try {
      await this.runLoop();
      this.session.markCompleted();
      await this.updateSessionState();
      this.log("Build loop completed");
    } finally {
      this.logStream?.close();
    }
  }

  private async runLoop(): Promise<void> {
    while (true) {
      const impl = await Implementation.load();
      if (!impl) {
        console.log(pc.red("No implementation.json found."));
        break;
      }

      const next = impl.nextPendingTask;
      if (!next) {
        console.log(pc.green("\n✓ All tasks completed!"));
        await this.notificationService?.notify(
          "loop_completed",
          this.session.iteration
        );
        break;
      }

      const { spec, task } = next;
      this.session.incrementIteration();
      await this.updateSessionState();

      console.log(
        pc.cyan(`\n📋 Task ${this.session.iteration}: ${task.description}`)
      );
      console.log(pc.gray(`   Spec: ${spec.name}`));
      this.log(`Starting task: ${task.id} - ${task.description}`);

      task.markInProgress();
      await impl.save();

      const taskPrompt = generateTaskPrompt(spec, task);
      const result = await this.agentRunner?.run({
        prompt: taskPrompt,
        onSpawn: (child) => {
          this.currentChild = child;
          if (child.pid) {
            this.session.setPid(child.pid);
          }
          this.updateSessionState().catch(() => {
            // fire-and-forget
          });
        },
      });

      if (!result) {
        console.log(pc.red("  ✗ Agent runner not initialized"));
        break;
      }

      if (result.status === "blocked") {
        console.log(pc.yellow(`  ⚠ Task blocked: ${result.reason}`));
        this.log(`Task blocked: ${result.reason}`);
        task.block(result.reason || "Unknown");
        await impl.save();
        continue;
      }

      if (result.status === "done") {
        console.log(pc.green("  ✓ Task completed"));
        this.log(`Task completed: ${task.id}`);
        task.complete();
        await impl.save();
        await this.notificationService?.notify(
          "iteration_success",
          this.session.iteration,
          task.description
        );
        if (spec.isCompleted) {
          console.log(pc.green(`\n✓ Spec completed: ${spec.name}`));
          this.log(`Spec completed: ${spec.name}`);
        }
      } else {
        console.log(pc.red("  ✗ Task failed"));
        this.log(`Task failed: ${task.id}`);
        task.fail();
        await impl.save();
        await this.notificationService?.notify(
          "iteration_failure",
          this.session.iteration,
          task.description
        );
      }

      console.log(pc.gray(`\n${"=".repeat(50)}\n`));
    }
  }
}
