import type { ChildProcess } from "node:child_process";
import { join } from "node:path";
import fse from "fs-extra";
import pc from "picocolors";
import { getAgent } from "../agents/index";
import { FILES } from "../constants";
import { Session } from "../domain/session";
import { Workspace } from "../domain/workspace";
import type { HookPayload, PlanOptions } from "../types";
import { getRalphDir } from "../utils/paths";
import { AgentRunner } from "./agent-runner";
import { ConsoleListener } from "./console-listener";
import { HookDispatcher } from "./hook-dispatcher";
import { LoggerService } from "./logger-service";
import { TelegramListener } from "./notification-service";

interface PlannerState {
  workspace: Workspace;
  session: Session;
  prompt: string;
}

export class Planner {
  private state: PlannerState | null = null;
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
      throw new Error("Planner state not initialized");
    }
    const { workspace, session } = this.state;
    const agent = getAgent(session.agent);
    return {
      projectName: workspace.config.projectName,
      mode: session.mode,
      sessionId: session.id,
      iteration: session.iteration,
      agent: agent.name,
      model: session.model,
      promptFile: FILES.PROMPT_PLAN,
      logFile: this.logger?.logFile ?? undefined,
      ...overrides,
    };
  }

  private async validate(
    options: PlanOptions
  ): Promise<PlannerState | { error: string }> {
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

    const modeConfig = workspace.config.agents.plan;
    const agentType = options.agent || modeConfig.agent;
    const model = options.model || modeConfig.model;
    const agent = getAgent(agentType);

    if (!(await agent.checkInstalled())) {
      return {
        error: `${agent.name} is not installed.\n${agent.getInstallInstructions()}`,
      };
    }

    const promptPath = join(getRalphDir(), FILES.PROMPT_PLAN);
    if (!(await fse.pathExists(promptPath))) {
      return {
        error: `Prompt file not found: ${FILES.PROMPT_PLAN}. Run \`ralph-wiggum-cli init\` to create it.`,
      };
    }

    const prompt = await fse.readFile(promptPath, "utf-8");
    const session = Session.create({ mode: "plan", agent: agentType, model });

    return { workspace, session, prompt };
  }

  private setupServices(state: PlannerState): void {
    this.logger = new LoggerService({ verbose: this.verbose });
    this.logger.startSessionLog(state.session.id);
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
        config: state.workspace.config.notifications?.telegram,
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
      }
      this.state.session.markStopped();
      this.state.workspace.sessionManager.update(this.state.session);
      await this.state.workspace.save();
      this.logger?.log("Plan mode stopped by user");
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

  async run(options: PlanOptions): Promise<void> {
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

    this.logger?.log(`Starting plan mode - Session ${this.state.session.id}`);

    try {
      const runResult = await this.agentRunner?.run({
        prompt: this.state.prompt,
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

      if (runResult?.status === "done") {
        this.state.session.markCompleted();
        await this.hooks?.emit("onLoopCompleted", this.buildPayload());
      } else {
        this.state.session.markStopped();
        console.log(pc.yellow("\n⚠ Plan mode stopped"));
      }

      await this.updateSessionState();
      this.logger?.log("Plan mode completed");
    } finally {
      this.logger?.close();
    }
  }
}
