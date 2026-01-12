import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fse from "fs-extra";
import {
  deleteSession,
  getAllProjects,
  getAllSessions,
  getProjectConfig,
  getProjectSessions,
  initProject,
  loadGlobalConfig,
  saveGlobalConfig,
  saveSession,
} from "../config.js";
import type { RalphSession } from "../types.js";

// Use a unique temp directory for each test run to avoid conflicts
const TEST_DIR = join(
  tmpdir(),
  `ralph-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

// Track project IDs created in tests for cleanup
const createdProjectIds: string[] = [];
const createdSessionIds: string[] = [];

describe("Config Module", () => {
  beforeAll(async () => {
    // Create test directory for project paths
    await fse.ensureDir(TEST_DIR);
  });

  afterAll(async () => {
    // Clean up test directories
    await fse.remove(TEST_DIR);

    // Clean up projects and sessions from global config
    const config = await loadGlobalConfig();
    for (const id of createdProjectIds) {
      delete config.projects[id];
    }
    for (const id of createdSessionIds) {
      delete config.sessions[id];
    }
    await saveGlobalConfig(config);
  });

  describe("initProject()", () => {
    it("creates correct config structure", async () => {
      const projectPath = join(TEST_DIR, "test-project");
      await fse.ensureDir(projectPath);

      const config = await initProject(projectPath, "claude", "sonnet");
      createdProjectIds.push(config.projectId);

      expect(config.projectPath).toBe(projectPath);
      expect(config.agent).toBe("claude");
      expect(config.model).toBe("sonnet");
      expect(config.projectName).toBe("test-project");
      expect(config.projectId).toBeDefined();
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();
    });

    it("saves project to global config", async () => {
      const projectPath = join(TEST_DIR, "test-project-2");
      await fse.ensureDir(projectPath);

      const config = await initProject(projectPath, "amp");
      createdProjectIds.push(config.projectId);

      const globalConfig = await loadGlobalConfig();
      expect(globalConfig.projects[config.projectId]).toBeDefined();
      expect(globalConfig.projects[config.projectId].projectPath).toBe(
        projectPath
      );
    });

    it("does not create redundant specs directory at project root", async () => {
      const projectPath = join(TEST_DIR, "test-project-3");
      await fse.ensureDir(projectPath);

      const config = await initProject(projectPath, "droid");
      createdProjectIds.push(config.projectId);

      // Should NOT create specs/ at project root (that's init.ts's job to create .ralph/specs/)
      const specsExists = await fse.pathExists(join(projectPath, "specs"));
      expect(specsExists).toBe(false);
    });
  });

  describe("getProjectConfig()", () => {
    it("returns null for uninitialized projects", async () => {
      const projectPath = join(TEST_DIR, "uninitialized-project");
      await fse.ensureDir(projectPath);

      const config = await getProjectConfig(projectPath);

      expect(config).toBeNull();
    });

    it("returns config for initialized projects", async () => {
      const projectPath = join(TEST_DIR, "initialized-project");
      await fse.ensureDir(projectPath);

      const initConfig = await initProject(projectPath, "claude", "opus");
      createdProjectIds.push(initConfig.projectId);

      const config = await getProjectConfig(projectPath);

      expect(config).not.toBeNull();
      expect(config?.agent).toBe("claude");
      expect(config?.model).toBe("opus");
    });
  });

  describe("Session Management", () => {
    it("saveSession() and getProjectSessions() work correctly", async () => {
      const projectPath = join(TEST_DIR, "session-project");
      await fse.ensureDir(projectPath);

      const projectConfig = await initProject(projectPath, "claude");
      createdProjectIds.push(projectConfig.projectId);

      const sessionId = `test-session-${Date.now()}`;
      createdSessionIds.push(sessionId);

      const session: RalphSession = {
        id: sessionId,
        projectId: projectConfig.projectId,
        mode: "plan",
        status: "running",
        iteration: 1,
        startedAt: new Date().toISOString(),
        agent: "claude",
        logFile: "/tmp/test.log",
      };

      await saveSession(session);

      const sessions = await getProjectSessions(projectConfig.projectId);

      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe(sessionId);
      expect(sessions[0].mode).toBe("plan");
      expect(sessions[0].status).toBe("running");
    });

    it("getAllSessions() includes saved sessions", async () => {
      const projectPath = join(TEST_DIR, "multi-session-project");
      await fse.ensureDir(projectPath);

      const projectConfig = await initProject(projectPath, "amp");
      createdProjectIds.push(projectConfig.projectId);

      const sessionId1 = `session-a-${Date.now()}`;
      const sessionId2 = `session-b-${Date.now()}`;
      createdSessionIds.push(sessionId1, sessionId2);

      const session1: RalphSession = {
        id: sessionId1,
        projectId: projectConfig.projectId,
        mode: "plan",
        status: "completed",
        iteration: 5,
        startedAt: new Date().toISOString(),
        agent: "amp",
        logFile: "/tmp/a.log",
      };

      const session2: RalphSession = {
        id: sessionId2,
        projectId: projectConfig.projectId,
        mode: "build",
        status: "running",
        iteration: 2,
        startedAt: new Date().toISOString(),
        agent: "amp",
        logFile: "/tmp/b.log",
      };

      await saveSession(session1);
      await saveSession(session2);

      const allSessions = await getAllSessions();
      const ourSessions = allSessions.filter(
        (s) => s.id === sessionId1 || s.id === sessionId2
      );

      expect(ourSessions.length).toBe(2);
    });

    it("deleteSession() removes session from config", async () => {
      const projectPath = join(TEST_DIR, "delete-session-project");
      await fse.ensureDir(projectPath);

      const projectConfig = await initProject(projectPath, "droid");
      createdProjectIds.push(projectConfig.projectId);

      const sessionId = `to-delete-${Date.now()}`;
      // Don't add to createdSessionIds since we're deleting it

      const session: RalphSession = {
        id: sessionId,
        projectId: projectConfig.projectId,
        mode: "build",
        status: "stopped",
        iteration: 3,
        startedAt: new Date().toISOString(),
        agent: "droid",
        logFile: "/tmp/delete.log",
      };

      await saveSession(session);
      let sessions = await getProjectSessions(projectConfig.projectId);
      expect(sessions.length).toBe(1);

      await deleteSession(sessionId);
      sessions = await getProjectSessions(projectConfig.projectId);
      expect(sessions.length).toBe(0);
    });
  });

  describe("getAllProjects()", () => {
    it("includes registered projects", async () => {
      const projectPath1 = join(TEST_DIR, "project-1");
      const projectPath2 = join(TEST_DIR, "project-2");
      await fse.ensureDir(projectPath1);
      await fse.ensureDir(projectPath2);

      const config1 = await initProject(projectPath1, "claude");
      const config2 = await initProject(projectPath2, "amp");
      createdProjectIds.push(config1.projectId, config2.projectId);

      const projects = await getAllProjects();
      const ourProjects = projects.filter(
        (p) =>
          p.projectId === config1.projectId || p.projectId === config2.projectId
      );

      expect(ourProjects.length).toBe(2);
    });
  });

  describe("loadGlobalConfig() and saveGlobalConfig()", () => {
    it("returns config with expected structure", async () => {
      const config = await loadGlobalConfig();

      expect(config.defaultAgent).toBeDefined();
      expect(config.projects).toBeDefined();
      expect(config.sessions).toBeDefined();
    });

    it("persists config changes", async () => {
      const config = await loadGlobalConfig();
      const originalAgent = config.defaultAgent;

      // Toggle the default agent
      config.defaultAgent = originalAgent === "droid" ? "claude" : "droid";
      await saveGlobalConfig(config);

      const loadedConfig = await loadGlobalConfig();
      expect(loadedConfig.defaultAgent).not.toBe(originalAgent);

      // Restore original value
      loadedConfig.defaultAgent = originalAgent;
      await saveGlobalConfig(loadedConfig);
    });
  });
});
