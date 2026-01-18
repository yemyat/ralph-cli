import { basename, join } from "node:path";
import fse from "fs-extra";
import {
  GUARDRAILS_TEMPLATE,
  PROGRESS_TEMPLATE,
  PROMPT_PLAN,
  SPEC_TEMPLATE,
} from "../templates/prompts";
import type { InitProjectOptions, ProjectState, RalphConfig } from "../types";
import {
  getConfigFile,
  getLogsDir,
  getRalphDir,
  getSpecsDir,
  RALPH_LOGS_DIR,
} from "../utils/paths";
import { Implementation } from "./implementation";
import { SessionManager } from "./session-manager";

export class Workspace {
  private readonly _config: RalphConfig;
  private readonly _sessionManager: SessionManager;

  private constructor(state: ProjectState) {
    this._config = state.config;
    this._sessionManager = new SessionManager(state.sessions);
  }

  get config(): RalphConfig {
    return this._config;
  }

  get sessionManager(): SessionManager {
    return this._sessionManager;
  }

  loadImplementation(): Promise<Implementation | null> {
    return Implementation.load();
  }

  async save(): Promise<void> {
    this._config.updatedAt = new Date().toISOString();
    const state: ProjectState = {
      config: this._config,
      sessions: this._sessionManager.toData(),
    };
    await fse.writeJson(getConfigFile(), state, { spaces: 2 });
  }

  async ensureProjectFiles(): Promise<void> {
    const ralphDir = getRalphDir();
    const specsDir = getSpecsDir();

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
      const newImpl = Implementation.createEmpty();
      await newImpl.save("user");
    }

    const specsFiles = await fse.readdir(specsDir);
    if (specsFiles.length === 0) {
      await fse.writeFile(join(specsDir, "example.md"), SPEC_TEMPLATE);
    }

    await this.updateGitignore();
  }

  private async updateGitignore(): Promise<void> {
    const gitignorePath = join(process.cwd(), ".gitignore");
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
    const configFile = getConfigFile();
    if (!(await fse.pathExists(configFile))) {
      return null;
    }

    try {
      const state = await fse.readJson(configFile);
      return new Workspace(state as ProjectState);
    } catch {
      return null;
    }
  }

  static async init(options: InitProjectOptions): Promise<Workspace> {
    const ralphDir = getRalphDir();
    const logsDir = getLogsDir();
    const specsDir = getSpecsDir();

    await fse.ensureDir(ralphDir);
    await fse.ensureDir(logsDir);
    await fse.ensureDir(specsDir);

    const config: RalphConfig = {
      projectName: basename(process.cwd()),
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

    const workspace = new Workspace(state);
    await workspace.save();

    return workspace;
  }
}
