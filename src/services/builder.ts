import type { ChildProcess } from "node:child_process";
import Mustache from "mustache";
import pc from "picocolors";
import { getAgent } from "../agents/index";
import { Implementation } from "../domain/implementation";
import { Session } from "../domain/session";
import { Workspace } from "../domain/workspace";
import { PROMPT_BUILD } from "../templates/prompts";
import type { BuildOptions, RalphConfig, SpecLike, TaskLike } from "../types";
import { AgentRunner } from "./agent-runner";
import { LoggerService } from "./logger-service";
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

interface BuilderState {
  config: RalphConfig;
  workspace: Workspace;
  session: Session;
}

export class Builder {
  private state: BuilderState | null = null;
  private readonly verbose: boolean;

  private logger: LoggerService | null = null;
  private currentChild: ChildProcess | null = null;
  private agentRunner: AgentRunner | null = null;
  private notificationService: NotificationService | null = null;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  private async validate(
    options: BuildOptions
  ): Promise<BuilderState | { error: string }> {
    const workspace = await Workspace.load();
    if (!workspace) {
      return {
        error: "Ralph is not initialized. Run `ralph-wiggum-cli init` first.",
      };
    }

    const runningSession = workspace.sessionManager.running[0];
    if (runningSession) {
      return {
        error: `Already running session: ${runningSession.id}. Use \`ralph-wiggum-cli stop\` to stop it first.`,
      };
    }

    const modeConfig = workspace.config.agents.build;
    const agentType = options.agent || modeConfig.agent;
    const model = options.model || modeConfig.model;
    const agent = getAgent(agentType);

    if (!(await agent.checkInstalled())) {
      return {
        error: `${agent.name} is not installed.\n${agent.getInstallInstructions()}`,
      };
    }

    const impl = await Implementation.load();
    if (!impl || impl.specs.length === 0) {
      return {
        error:
          "No specs found in implementation.json. Run `ralph-wiggum-cli plan` first.",
      };
    }

    const session = Session.create({ mode: "build", agent: agentType, model });

    return { config: workspace.config, workspace, session };
  }

  private printBanner(state: BuilderState): void {
    const { session } = state;
    const agent = getAgent(session.agent);

    console.log(pc.green("\n🚀 Starting Ralph build loop...\n"));
    console.log(`  Session: ${pc.cyan(session.id)}`);
    console.log(`  Agent:   ${pc.cyan(agent.name)}`);
    console.log(`  Model:   ${pc.cyan(session.model || "default")}`);
    console.log(pc.gray("\nPress Ctrl+C to stop.\n"));
  }

  private setupServices(state: BuilderState): void {
    this.logger = new LoggerService({ verbose: this.verbose });
    const agent = getAgent(state.session.agent);

    this.agentRunner = new AgentRunner({
      agent,
      model: state.session.model,
      verbose: this.verbose,
      logger: this.logger,
    });

    this.notificationService = new NotificationService({
      config: state.config.notifications,
      context: {
        projectName: state.config.projectName,
        mode: state.session.mode,
        sessionId: state.session.id,
      },
      logger: this.logger,
    });
  }

  private setupSignalHandlers(): void {
    const handleSignal = async () => {
      if (!this.state) {
        return;
      }
      console.log(pc.yellow("\n\nStopping Ralph loop..."));
      if (this.currentChild && !this.currentChild.killed) {
        this.currentChild.kill("SIGTERM");
        console.log(pc.gray("Terminated agent process"));
      }
      this.state.session.markStopped();
      this.state.workspace.sessionManager.update(this.state.session);
      await this.state.workspace.save();
      this.logger?.log("Loop stopped by user");
      await this.notificationService?.notify(
        "loop_stopped",
        this.state.session.iteration
      );
      this.logger?.close();
      process.exit(0);
    };

    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);
  }

  private async updateSessionState(): Promise<void> {
    if (!this.state) {
      return;
    }
    this.state.workspace.sessionManager.update(this.state.session);
    await this.state.workspace.save();
  }

  async run(options: BuildOptions): Promise<void> {
    const result = await this.validate(options);
    if ("error" in result) {
      console.log(pc.red(result.error));
      return;
    }

    this.state = result;
    this.setupServices(this.state);
    this.printBanner(this.state);
    this.setupSignalHandlers();

    this.state.workspace.sessionManager.add(this.state.session);
    await this.state.workspace.save();

    this.logger?.log(`Starting build loop - Session ${this.state.session.id}`);
    await this.notificationService?.notify(
      "loop_started",
      this.state.session.iteration
    );

    try {
      await this.runLoop();
      this.state.session.markCompleted();
      await this.updateSessionState();
      this.logger?.log("Build loop completed");
    } finally {
      this.logger?.close();
    }
  }

  private async runLoop(): Promise<void> {
    if (!this.state) {
      return;
    }
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
          this.state.session.iteration
        );
        break;
      }

      const { spec, task } = next;
      this.state.session.incrementIteration();
      await this.updateSessionState();

      this.logger?.startTaskLog(task.id);

      console.log(
        pc.cyan(
          `\n📋 Task ${this.state.session.iteration}: ${task.description}`
        )
      );
      console.log(pc.gray(`   Spec: ${spec.name}`));
      if (this.logger?.logFile) {
        console.log(pc.gray(`   Log:  ${this.logger.logFile}`));
      }
      this.logger?.log(`Starting task: ${task.id} - ${task.description}`);

      task.markInProgress();
      await impl.save();

      const taskPrompt = generateTaskPrompt(spec, task);
      const result = await this.agentRunner?.run({
        prompt: taskPrompt,
        onSpawn: (child) => {
          this.currentChild = child;
          if (child.pid && this.state) {
            this.state.session.setPid(child.pid);
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
        this.logger?.log(`Task blocked: ${result.reason}`);
        task.block(result.reason || "Unknown");
        await impl.save();
        continue;
      }

      if (result.status === "done") {
        console.log(pc.green("  ✓ Task completed"));
        this.logger?.log(`Task completed: ${task.id}`);
        task.complete();
        await impl.save();
        await this.notificationService?.notify(
          "iteration_success",
          this.state.session.iteration,
          task.description
        );
        if (spec.isCompleted) {
          console.log(pc.green(`\n✓ Spec completed: ${spec.name}`));
          this.logger?.log(`Spec completed: ${spec.name}`);
        }
      } else {
        console.log(pc.red("  ✗ Task failed"));
        this.logger?.log(`Task failed: ${task.id}`);
        task.fail();
        await impl.save();
        await this.notificationService?.notify(
          "iteration_failure",
          this.state.session.iteration,
          task.description
        );
      }

      console.log(pc.gray(`\n${"=".repeat(50)}\n`));
    }
  }
}
