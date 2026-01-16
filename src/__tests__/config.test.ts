import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fse from "fs-extra";
import {
  deleteSession,
  getProjectConfig,
  getProjectSessions,
  getSession,
  initProject,
  loadProjectState,
  saveSession,
} from "../config";
import type { RalphSession } from "../types";
import { getRalphDir } from "../utils/paths";

const TEST_DIR = join(
  tmpdir(),
  `ralph-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

describe("Config Module", () => {
  beforeAll(async () => {
    await fse.ensureDir(TEST_DIR);
  });

  afterAll(async () => {
    await fse.remove(TEST_DIR);
  });

  describe("initProject()", () => {
    it("creates correct config structure", async () => {
      const projectPath = join(TEST_DIR, "test-project");
      await fse.ensureDir(projectPath);

      const config = await initProject(projectPath, {
        planAgent: "claude",
        planModel: "sonnet",
        buildAgent: "amp",
        buildModel: "smart",
      });

      expect(config.agents.plan.agent).toBe("claude");
      expect(config.agents.plan.model).toBe("sonnet");
      expect(config.agents.build.agent).toBe("amp");
      expect(config.agents.build.model).toBe("smart");
      expect(config.projectName).toBe("test-project");
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();
    });

    it("creates .ralph-wiggum directory", async () => {
      const projectPath = join(TEST_DIR, "test-project-2");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "amp",
        buildAgent: "amp",
      });

      const ralphDir = getRalphDir(projectPath);
      const exists = await fse.pathExists(ralphDir);
      expect(exists).toBe(true);
    });

    it("creates logs and specs directories", async () => {
      const projectPath = join(TEST_DIR, "test-project-3");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "droid",
        buildAgent: "droid",
      });

      const ralphDir = getRalphDir(projectPath);
      const logsExists = await fse.pathExists(join(ralphDir, "logs"));
      const specsExists = await fse.pathExists(join(ralphDir, "specs"));

      expect(logsExists).toBe(true);
      expect(specsExists).toBe(true);
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

      await initProject(projectPath, {
        planAgent: "claude",
        planModel: "opus",
        buildAgent: "claude",
        buildModel: "opus",
      });

      const config = await getProjectConfig(projectPath);

      expect(config).not.toBeNull();
      expect(config?.agents.plan.agent).toBe("claude");
      expect(config?.agents.plan.model).toBe("opus");
    });
  });

  describe("Session Management", () => {
    it("saveSession() and getProjectSessions() work correctly", async () => {
      const projectPath = join(TEST_DIR, "session-project");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "claude",
        buildAgent: "claude",
      });

      const sessionId = `test-session-${Date.now()}`;

      const session: RalphSession = {
        id: sessionId,
        mode: "plan",
        status: "running",
        iteration: 1,
        startedAt: new Date().toISOString(),
        agent: "claude",
      };

      await saveSession(projectPath, session);

      const sessions = await getProjectSessions(projectPath);

      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe(sessionId);
      expect(sessions[0].mode).toBe("plan");
      expect(sessions[0].status).toBe("running");
    });

    it("getSession() retrieves specific session", async () => {
      const projectPath = join(TEST_DIR, "get-session-project");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "amp",
        buildAgent: "amp",
      });

      const sessionId = `session-${Date.now()}`;
      const session: RalphSession = {
        id: sessionId,
        mode: "build",
        status: "completed",
        iteration: 5,
        startedAt: new Date().toISOString(),
        agent: "amp",
      };

      await saveSession(projectPath, session);

      const retrieved = await getSession(projectPath, sessionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(sessionId);
      expect(retrieved?.mode).toBe("build");
    });

    it("deleteSession() removes session", async () => {
      const projectPath = join(TEST_DIR, "delete-session-project");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "droid",
        buildAgent: "droid",
      });

      const sessionId = `to-delete-${Date.now()}`;
      const session: RalphSession = {
        id: sessionId,
        mode: "build",
        status: "stopped",
        iteration: 3,
        startedAt: new Date().toISOString(),
        agent: "droid",
      };

      await saveSession(projectPath, session);
      let sessions = await getProjectSessions(projectPath);
      expect(sessions.length).toBe(1);

      await deleteSession(projectPath, sessionId);
      sessions = await getProjectSessions(projectPath);
      expect(sessions.length).toBe(0);
    });

    it("saveSession() updates existing session", async () => {
      const projectPath = join(TEST_DIR, "update-session-project");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "claude",
        buildAgent: "claude",
      });

      const sessionId = `update-${Date.now()}`;
      const session: RalphSession = {
        id: sessionId,
        mode: "plan",
        status: "running",
        iteration: 1,
        startedAt: new Date().toISOString(),
        agent: "claude",
      };

      await saveSession(projectPath, session);

      session.iteration = 5;
      session.status = "completed";
      await saveSession(projectPath, session);

      const sessions = await getProjectSessions(projectPath);
      expect(sessions.length).toBe(1);
      expect(sessions[0].iteration).toBe(5);
      expect(sessions[0].status).toBe("completed");
    });
  });

  describe("loadProjectState()", () => {
    it("returns null for uninitialized project", async () => {
      const projectPath = join(TEST_DIR, "no-state-project");
      await fse.ensureDir(projectPath);

      const state = await loadProjectState(projectPath);

      expect(state).toBeNull();
    });

    it("returns state with config and sessions", async () => {
      const projectPath = join(TEST_DIR, "state-project");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "claude",
        buildAgent: "claude",
      });

      const state = await loadProjectState(projectPath);

      expect(state).not.toBeNull();
      expect(state?.config).toBeDefined();
      expect(state?.sessions).toBeDefined();
      expect(Array.isArray(state?.sessions)).toBe(true);
    });
  });
});
