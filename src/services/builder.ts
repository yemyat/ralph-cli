import type { ChildProcess } from "node:child_process";
import Mustache from "mustache";
import pc from "picocolors";
import { getAgent } from "../agents/index";
import { Implementation } from "../domain/implementation";
import { Session } from "../domain/session";
import type { Spec } from "../domain/spec";
import type { Task } from "../domain/task";
import { Workspace } from "../domain/workspace";
import { PROMPT_BUILD } from "../templates/prompts";
import type { BuildOptions, HookPayload, RalphConfig } from "../types";
import { AgentRunner } from "./agent-runner";
import { ConsoleListener } from "./console-listener";
import { HookDispatcher } from "./hook-dispatcher";
import { LoggerService } from "./logger-service";
import { TelegramListener } from "./notification-service";

function generateTaskPrompt(spec: Spec, task: Task): string {
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
  private hooks: HookDispatcher | null = null;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  private buildPayload(overrides: Partial<HookPayload> = {}): HookPayload {
    if (!this.state) {
      throw new Error("Builder state not initialized");
    }
    const { config, session } = this.state;
    const agent = getAgent(session.agent);
    return {
      projectName: config.projectName,
      mode: session.mode,
      sessionId: session.id,
      iteration: session.iteration,
      agent: agent.name,
      model: session.model,
      ...overrides,
    };
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

  private setupServices(state: BuilderState): void {
    this.logger = new LoggerService({ verbose: this.verbose });
    const agent = getAgent(state.session.agent);

    this.agentRunner = new AgentRunner({
      agent,
      model: state.session.model,
      verbose: this.verbose,
      logger: this.logger,
    });

    this.hooks = new HookDispatcher();
    this.hooks.register(new ConsoleListener());
    this.hooks.register(
      new TelegramListener({
        config: state.config.notifications?.telegram,
        onError: (err) =>
          this.logger?.log(`Telegram notification failed: ${err}`),
      })
    );
  }

  private setupSignalHandlers(): void {
    const handleSignal = async () => {
      if (!this.state) {
        return;
      }
      await this.hooks?.emit("onLoopStopped", this.buildPayload());
      if (this.currentChild && !this.currentChild.killed) {
        this.currentChild.kill("SIGTERM");
        console.log(pc.gray("Terminated agent process"));
      }
      this.state.session.markStopped();
      this.state.workspace.sessionManager.update(this.state.session);
      await this.state.workspace.save();
      this.logger?.log("Loop stopped by user");
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
    this.setupSignalHandlers();

    await this.hooks?.emit("onLoopStarted", this.buildPayload());

    this.state.workspace.sessionManager.add(this.state.session);
    await this.state.workspace.save();

    this.logger?.log(`Starting build loop - Session ${this.state.session.id}`);

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
        await this.hooks?.emit("onLoopCompleted", this.buildPayload());
        break;
      }

      const { spec, task } = next;
      this.state.session.incrementIteration();
      await this.updateSessionState();

      this.logger?.startTaskLog(task.id);

      await this.hooks?.emit(
        "onIterationStarted",
        this.buildPayload({
          taskDescription: task.description,
          specName: spec.name,
          logFile: this.logger?.logFile ?? undefined,
        })
      );
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
        await this.hooks?.emit(
          "onTaskBlocked",
          this.buildPayload({ taskDescription: result.reason })
        );
        this.logger?.log(`Task blocked: ${result.reason}`);
        task.block(result.reason || "Unknown");
        await impl.save();
        continue;
      }

      if (result.status === "done") {
        await this.hooks?.emit(
          "onIterationSuccess",
          this.buildPayload({ taskDescription: task.description })
        );
        this.logger?.log(`Task completed: ${task.id}`);
        task.complete();
        await impl.save();
        if (spec.isCompleted) {
          await this.hooks?.emit(
            "onSpecCompleted",
            this.buildPayload({ specName: spec.name })
          );
          this.logger?.log(`Spec completed: ${spec.name}`);
        }
      } else {
        await this.hooks?.emit(
          "onIterationFailure",
          this.buildPayload({ taskDescription: task.description })
        );
        this.logger?.log(`Task failed: ${task.id}`);
        task.fail();
        await impl.save();
      }

      console.log(pc.gray(`\n${"=".repeat(50)}\n`));
    }
  }
}
