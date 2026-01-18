import type { ChildProcess } from "node:child_process";
import fse from "fs-extra";
import pc from "picocolors";
import type { BaseAgent } from "../agents/base";
import type { Session } from "../domain/session";
import type { Workspace } from "../domain/workspace";
import type { PlannerOptions } from "../types";
import { AgentRunner } from "./agent-runner";

export class Planner {
  private readonly workspace: Workspace;
  private readonly session: Session;
  private readonly logFile: string;
  private readonly agent: BaseAgent;
  private readonly prompt: string;
  private readonly verbose: boolean;

  private logStream: fse.WriteStream | null = null;
  private currentChild: ChildProcess | null = null;
  private agentRunner: AgentRunner | null = null;

  constructor(options: PlannerOptions) {
    this.workspace = options.workspace;
    this.session = options.session;
    this.logFile = options.logFile;
    this.agent = options.agent;
    this.prompt = options.prompt;
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
  }

  private setupSignalHandlers(): void {
    const handleSignal = async () => {
      console.log(pc.yellow("\n\nStopping..."));
      if (this.currentChild && !this.currentChild.killed) {
        this.currentChild.kill("SIGTERM");
      }
      this.session.markStopped();
      this.workspace.sessionManager.update(this.session);
      await this.workspace.save();
      this.log("Plan mode stopped by user");
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

    this.log(`Starting plan mode - Session ${this.session.id}`);

    try {
      const result = await this.agentRunner?.run({
        prompt: this.prompt,
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

      if (result?.status === "done") {
        this.session.markCompleted();
        console.log(pc.green("\n✓ Plan mode completed"));
      } else {
        this.session.markStopped();
        console.log(pc.yellow("\n⚠ Plan mode stopped"));
      }

      await this.updateSessionState();
      this.log("Plan mode completed");
    } finally {
      this.logStream?.close();
    }
  }
}
