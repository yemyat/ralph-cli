import { basename, join } from "node:path";
import fse from "fs-extra";
import {
  GUARDRAILS_TEMPLATE,
  PROGRESS_TEMPLATE,
  PROMPT_PLAN,
  SPEC_TEMPLATE,
} from "../templates/prompts";
import type {
  InitProjectOptions,
  ProjectState,
  RalphConfig,
  RalphSession,
} from "../types";
import {
  getConfigFile,
  getLogsDir,
  getRalphDir,
  getSpecsDir,
  RALPH_LOGS_DIR,
} from "../utils/paths";
import { Implementation } from "./implementation";

export class Workspace {
  private readonly _projectPath: string;
  private readonly _config: RalphConfig;
  private _sessions: RalphSession[];

  private constructor(projectPath: string, state: ProjectState) {
    this._projectPath = projectPath;
    this._config = state.config;
    this._sessions = state.sessions;
  }

  get projectPath(): string {
    return this._projectPath;
  }

  get config(): RalphConfig {
    return this._config;
  }

  get sessions(): RalphSession[] {
    return this._sessions;
  }

  get runningSessions(): RalphSession[] {
    return this._sessions.filter((s) => s.status === "running");
  }

  getSession(sessionId: string): RalphSession | undefined {
    return this._sessions.find((s) => s.id === sessionId);
  }

  async addSession(session: RalphSession): Promise<void> {
    const idx = this._sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      this._sessions[idx] = session;
    } else {
      this._sessions.push(session);
    }
    await this.save();
  }

  async updateSession(session: RalphSession): Promise<void> {
    await this.addSession(session);
  }

  async removeSession(sessionId: string): Promise<void> {
    this._sessions = this._sessions.filter((s) => s.id !== sessionId);
    await this.save();
  }

  loadImplementation(): Promise<Implementation | null> {
    return Implementation.load(this._projectPath);
  }

  async save(): Promise<void> {
    this._config.updatedAt = new Date().toISOString();
    const state: ProjectState = {
      config: this._config,
      sessions: this._sessions,
    };
    await fse.writeJson(getConfigFile(this._projectPath), state, { spaces: 2 });
  }

  async ensureProjectFiles(): Promise<void> {
    const ralphDir = getRalphDir(this._projectPath);
    const specsDir = getSpecsDir(this._projectPath);

    const ensureFile = async (path: string, content: string) => {
      if (!(await fse.pathExists(path))) {
        await fse.writeFile(path, content);
      }
    };

    await ensureFile(join(ralphDir, "PROMPT_plan.md"), PROMPT_PLAN);
    await ensureFile(join(ralphDir, "PROGRESS.md"), PROGRESS_TEMPLATE);
    await ensureFile(join(ralphDir, "GUARDRAILS.md"), GUARDRAILS_TEMPLATE);

    const impl = await this.loadImplementation();
    if (!impl) {
      const newImpl = Implementation.createEmpty(this._projectPath);
      await newImpl.save("user");
    }

    const specsFiles = await fse.readdir(specsDir);
    if (specsFiles.length === 0) {
      await fse.writeFile(join(specsDir, "example.md"), SPEC_TEMPLATE);
    }

    await this.updateGitignore();
  }

  private async updateGitignore(): Promise<void> {
    const gitignorePath = join(this._projectPath, ".gitignore");
    const logsPattern = `.ralph-wiggum/${RALPH_LOGS_DIR}/`;

    let gitignore = "";
    if (await fse.pathExists(gitignorePath)) {
      gitignore = await fse.readFile(gitignorePath, "utf-8");
      if (gitignore.includes(logsPattern)) {
        return;
      }
      if (!gitignore.endsWith("\n")) {
        gitignore += "\n";
      }
    }
    gitignore += `\n# Ralph Wiggum logs\n${logsPattern}\n`;
    await fse.writeFile(gitignorePath, gitignore);
  }

  static async load(): Promise<Workspace | null> {
    const projectPath = process.cwd();
    const configFile = getConfigFile(projectPath);
    if (!(await fse.pathExists(configFile))) {
      return null;
    }

    try {
      const state = await fse.readJson(configFile);
      return new Workspace(projectPath, state as ProjectState);
    } catch {
      return null;
    }
  }

  static async init(options: InitProjectOptions): Promise<Workspace> {
    const projectPath = process.cwd();
    const ralphDir = getRalphDir(projectPath);
    const logsDir = getLogsDir(projectPath);
    const specsDir = getSpecsDir(projectPath);

    await fse.ensureDir(ralphDir);
    await fse.ensureDir(logsDir);
    await fse.ensureDir(specsDir);

    const config: RalphConfig = {
      projectName: basename(projectPath),
      agents: {
        plan: {
          agent: options.planAgent,
          model: options.planModel,
        },
        build: {
          agent: options.buildAgent,
          model: options.buildModel,
        },
      },
      notifications: options.notifications,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const state: ProjectState = {
      config,
      sessions: [],
    };

    const workspace = new Workspace(projectPath, state);
    await workspace.save();

    return workspace;
  }
}
