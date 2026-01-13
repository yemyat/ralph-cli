import { basename } from "node:path";
import fse from "fs-extra";
import type { AgentType, ProjectState, RalphConfig, RalphSession } from "./types.js";
import {
  getConfigFile,
  getLogsDir,
  getRalphDir,
  getSpecsDir,
} from "./utils/paths.js";

export async function ensureRalphDirs(projectPath: string): Promise<void> {
  await fse.ensureDir(getRalphDir(projectPath));
  await fse.ensureDir(getLogsDir(projectPath));
  await fse.ensureDir(getSpecsDir(projectPath));
}

export async function loadProjectState(
  projectPath: string
): Promise<ProjectState | null> {
  const configFile = getConfigFile(projectPath);
  if (await fse.pathExists(configFile)) {
    return fse.readJson(configFile);
  }
  return null;
}

export async function saveProjectState(
  projectPath: string,
  state: ProjectState
): Promise<void> {
  await ensureRalphDirs(projectPath);
  state.config.updatedAt = new Date().toISOString();
  await fse.writeJson(getConfigFile(projectPath), state, { spaces: 2 });
}

export async function getProjectConfig(
  projectPath: string
): Promise<RalphConfig | null> {
  const state = await loadProjectState(projectPath);
  return state?.config || null;
}

export async function initProject(
  projectPath: string,
  agent: AgentType,
  model?: string
): Promise<RalphConfig> {
  await ensureRalphDirs(projectPath);

  const config: RalphConfig = {
    projectName: basename(projectPath),
    agent,
    model,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state: ProjectState = {
    config,
    sessions: [],
  };

  await saveProjectState(projectPath, state);
  return config;
}

export async function getSession(
  projectPath: string,
  sessionId: string
): Promise<RalphSession | null> {
  const state = await loadProjectState(projectPath);
  return state?.sessions.find((s) => s.id === sessionId) || null;
}

export async function saveSession(
  projectPath: string,
  session: RalphSession
): Promise<void> {
  const state = await loadProjectState(projectPath);
  if (!state) {
    throw new Error("Project not initialized");
  }

  const idx = state.sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    state.sessions[idx] = session;
  } else {
    state.sessions.push(session);
  }

  await saveProjectState(projectPath, state);
}

export async function deleteSession(
  projectPath: string,
  sessionId: string
): Promise<void> {
  const state = await loadProjectState(projectPath);
  if (!state) return;

  state.sessions = state.sessions.filter((s) => s.id !== sessionId);
  await saveProjectState(projectPath, state);
}

export async function getProjectSessions(
  projectPath: string
): Promise<RalphSession[]> {
  const state = await loadProjectState(projectPath);
  return state?.sessions || [];
}
