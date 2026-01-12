import fse from "fs-extra";
import { join, basename } from "path";
import {
  RALPH_HOME,
  RALPH_CONFIG_FILE,
  RALPH_PROJECTS_DIR,
  RALPH_LOGS_DIR,
  getProjectId,
  getProjectDir,
} from "./utils/paths.js";
import type { GlobalConfig, RalphConfig, RalphSession, AgentType } from "./types.js";

const DEFAULT_CONFIG: GlobalConfig = {
  defaultAgent: "claude",
  projects: {},
  sessions: {},
};

export async function ensureRalphDirs(): Promise<void> {
  await fse.ensureDir(RALPH_HOME);
  await fse.ensureDir(RALPH_PROJECTS_DIR);
  await fse.ensureDir(RALPH_LOGS_DIR);
}

export async function loadGlobalConfig(): Promise<GlobalConfig> {
  await ensureRalphDirs();
  if (await fse.pathExists(RALPH_CONFIG_FILE)) {
    return fse.readJson(RALPH_CONFIG_FILE);
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  await ensureRalphDirs();
  await fse.writeJson(RALPH_CONFIG_FILE, config, { spaces: 2 });
}

export async function getProjectConfig(projectPath: string): Promise<RalphConfig | null> {
  const config = await loadGlobalConfig();
  const projectId = getProjectId(projectPath);
  return config.projects[projectId] || null;
}

export async function saveProjectConfig(projectConfig: RalphConfig): Promise<void> {
  const config = await loadGlobalConfig();
  config.projects[projectConfig.projectId] = projectConfig;
  await saveGlobalConfig(config);
}

export async function initProject(
  projectPath: string,
  agent: AgentType,
  model?: string
): Promise<RalphConfig> {
  const projectId = getProjectId(projectPath);
  const projectDir = getProjectDir(projectId);
  await fse.ensureDir(projectDir);

  const projectConfig: RalphConfig = {
    projectId,
    projectPath,
    projectName: basename(projectPath),
    agent,
    model,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveProjectConfig(projectConfig);

  // Create project-specific directories
  const specsDir = join(projectPath, "specs");
  await fse.ensureDir(specsDir);

  return projectConfig;
}

export async function getSession(sessionId: string): Promise<RalphSession | null> {
  const config = await loadGlobalConfig();
  return config.sessions[sessionId] || null;
}

export async function saveSession(session: RalphSession): Promise<void> {
  const config = await loadGlobalConfig();
  config.sessions[session.id] = session;
  await saveGlobalConfig(config);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const config = await loadGlobalConfig();
  delete config.sessions[sessionId];
  await saveGlobalConfig(config);
}

export async function getProjectSessions(projectId: string): Promise<RalphSession[]> {
  const config = await loadGlobalConfig();
  return Object.values(config.sessions).filter((s) => s.projectId === projectId);
}

export async function getAllProjects(): Promise<RalphConfig[]> {
  const config = await loadGlobalConfig();
  return Object.values(config.projects);
}

export async function getAllSessions(): Promise<RalphSession[]> {
  const config = await loadGlobalConfig();
  return Object.values(config.sessions);
}
