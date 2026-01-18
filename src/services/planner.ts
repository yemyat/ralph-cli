import type { ChildProcess } from "node:child_process";
import { join } from "node:path";
import fse from "fs-extra";
import pc from "picocolors";
import { getAgent } from "../agents/index";
import { FILES } from "../constants";
import { Session } from "../domain/session";
import { Workspace } from "../domain/workspace";
import type { PlanOptions } from "../types";
import { getRalphDir, getSessionLogFile } from "../utils/paths";
import { AgentRunner } from "./agent-runner";

interface PlannerState {
  workspace: Workspace;
  session: Session;
  logFile: string;
  prompt: string;
}

export class Planner {
  private state: PlannerState | null = null;
  private readonly verbose: boolean;

  private logStream: fse.WriteStream | null = null;
  private currentChild: ChildProcess | null = null;
  private agentRunner: AgentRunner | null = null;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose ?? false;
  }

  private log(msg: string): void {
    const timestamp = new Date().toISOString();
    this.logStream?.write(`[${timestamp}] ${msg}\n`);
    if (this.verbose) {
      console.log(pc.gray(`[${timestamp}]`), msg);
    }
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
    const logFile = getSessionLogFile(session.id);

    return { workspace, session, logFile, prompt };
  }

  private printBanner(state: PlannerState): void {
    const { session, logFile } = state;
    const agent = getAgent(session.agent);

    console.log(pc.green("\n🚀 Starting Ralph plan mode...\n"));
    console.log(`  Session: ${pc.cyan(session.id)}`);
    console.log(`  Agent:   ${pc.cyan(agent.name)}`);
    console.log(`  Model:   ${pc.cyan(session.model || "default")}`);
    console.log(`  Prompt:  ${pc.cyan(FILES.PROMPT_PLAN)}`);
    console.log(`  Log:     ${pc.gray(logFile)}`);
    console.log(pc.gray("\nPress Ctrl+C to stop.\n"));
  }

  private setupServices(state: PlannerState): void {
    this.logStream = fse.createWriteStream(state.logFile, { flags: "a" });
    const agent = getAgent(state.session.agent);

    this.agentRunner = new AgentRunner({
      agent,
      model: state.session.model,
      verbose: this.verbose,
      log: (msg) => this.log(msg),
    });
  }

  private setupSignalHandlers(): void {
    const handleSignal = async () => {
      if (!this.state) {
        return;
      }
      console.log(pc.yellow("\n\nStopping..."));
      if (this.currentChild && !this.currentChild.killed) {
        this.currentChild.kill("SIGTERM");
      }
      this.state.session.markStopped();
      this.state.workspace.sessionManager.update(this.state.session);
      await this.state.workspace.save();
      this.log("Plan mode stopped by user");
      this.logStream?.close();
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
    this.printBanner(this.state);
    this.setupServices(this.state);
    this.setupSignalHandlers();

    this.state.workspace.sessionManager.add(this.state.session);
    await this.state.workspace.save();

    this.log(`Starting plan mode - Session ${this.state.session.id}`);

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
        console.log(pc.green("\n✓ Plan mode completed"));
      } else {
        this.state.session.markStopped();
        console.log(pc.yellow("\n⚠ Plan mode stopped"));
      }

      await this.updateSessionState();
      this.log("Plan mode completed");
    } finally {
      this.logStream?.close();
    }
  }
}
