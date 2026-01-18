import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fse from "fs-extra";
import { initProject } from "../../config";
import { getRalphDir, getSpecsDir, RALPH_LOGS_DIR } from "../../utils/paths";
import {
  addLogsToGitignore,
  createProjectFiles,
  ensureFile,
  isValidAgentType,
} from "../init-logic";

let testDir: string;

beforeEach(async () => {
  testDir = join(
    tmpdir(),
    `ralph-init-logic-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fse.ensureDir(testDir);
});

afterEach(async () => {
  await fse.remove(testDir);
});

describe("init-logic", () => {
  describe("addLogsToGitignore()", () => {
    it("creates .gitignore with logs pattern if file does not exist", async () => {
      await addLogsToGitignore(testDir);

      const gitignorePath = join(testDir, ".gitignore");
      const exists = await fse.pathExists(gitignorePath);
      expect(exists).toBe(true);

      const content = await fse.readFile(gitignorePath, "utf-8");
      expect(content).toContain(`.ralph-wiggum/${RALPH_LOGS_DIR}/`);
    });

    it("appends logs pattern to existing .gitignore", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      await fse.writeFile(gitignorePath, "node_modules/\n.env\n");

      await addLogsToGitignore(testDir);

      const content = await fse.readFile(gitignorePath, "utf-8");
      expect(content).toContain("node_modules/");
      expect(content).toContain(".env");
      expect(content).toContain(`.ralph-wiggum/${RALPH_LOGS_DIR}/`);
    });

    it("does not duplicate pattern if already present", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      const logsPattern = `.ralph-wiggum/${RALPH_LOGS_DIR}/`;
      await fse.writeFile(gitignorePath, `node_modules/\n${logsPattern}\n`);

      await addLogsToGitignore(testDir);

      const content = await fse.readFile(gitignorePath, "utf-8");
      const matches = content.match(
        new RegExp(logsPattern.replace("/", "\\/"), "g")
      );
      expect(matches?.length).toBe(1);
    });

    it("handles .gitignore without trailing newline", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      await fse.writeFile(gitignorePath, "node_modules/");

      await addLogsToGitignore(testDir);

      const content = await fse.readFile(gitignorePath, "utf-8");
      expect(content).toContain("node_modules/");
      expect(content).toContain(`.ralph-wiggum/${RALPH_LOGS_DIR}/`);
    });
  });

  describe("ensureFile()", () => {
    it("creates file if it does not exist", async () => {
      const filePath = join(testDir, "new-file.txt");
      const content = "test content";

      await ensureFile(filePath, content);

      const exists = await fse.pathExists(filePath);
      expect(exists).toBe(true);

      const fileContent = await fse.readFile(filePath, "utf-8");
      expect(fileContent).toBe(content);
    });

    it("does not overwrite existing file", async () => {
      const filePath = join(testDir, "existing-file.txt");
      const originalContent = "original content";
      const newContent = "new content";

      await fse.writeFile(filePath, originalContent);
      await ensureFile(filePath, newContent);

      const fileContent = await fse.readFile(filePath, "utf-8");
      expect(fileContent).toBe(originalContent);
    });
  });

  describe("createProjectFiles()", () => {
    beforeEach(async () => {
      await initProject(testDir, {
        planAgent: "claude",
        buildAgent: "claude",
      });
    });

    it("creates PROMPT_plan.md", async () => {
      await createProjectFiles(testDir);

      const filePath = join(getRalphDir(testDir), "PROMPT_plan.md");
      const exists = await fse.pathExists(filePath);
      expect(exists).toBe(true);
    });

    it("creates PROGRESS.md", async () => {
      await createProjectFiles(testDir);

      const filePath = join(getRalphDir(testDir), "PROGRESS.md");
      const exists = await fse.pathExists(filePath);
      expect(exists).toBe(true);
    });

    it("creates GUARDRAILS.md", async () => {
      await createProjectFiles(testDir);

      const filePath = join(getRalphDir(testDir), "GUARDRAILS.md");
      const exists = await fse.pathExists(filePath);
      expect(exists).toBe(true);
    });

    it("creates implementation.json", async () => {
      await createProjectFiles(testDir);

      const filePath = join(getRalphDir(testDir), "implementation.json");
      const exists = await fse.pathExists(filePath);
      expect(exists).toBe(true);
    });

    it("creates implementation.json with quality gates", async () => {
      await createProjectFiles(testDir);

      const filePath = join(getRalphDir(testDir), "implementation.json");
      const content = await fse.readJson(filePath);

      expect(content).toHaveProperty("qualityGates");
      expect(Array.isArray(content.qualityGates)).toBe(true);
      expect(content.qualityGates).toContain("bun run typecheck");
      expect(content.qualityGates).toContain("bun run lint");
      expect(content.qualityGates).toContain("bun run test");
      expect(content.qualityGates).toContain("bun run build");
    });

    it("does NOT overwrite existing PROMPT_plan.md", async () => {
      const filePath = join(getRalphDir(testDir), "PROMPT_plan.md");
      const originalContent = "# Custom Plan Prompt\nDo not overwrite this.";
      await fse.writeFile(filePath, originalContent);

      await createProjectFiles(testDir);

      const content = await fse.readFile(filePath, "utf-8");
      expect(content).toBe(originalContent);
    });

    it("does NOT overwrite existing GUARDRAILS.md", async () => {
      const filePath = join(getRalphDir(testDir), "GUARDRAILS.md");
      const originalContent = "# Custom Guardrails\nDo not overwrite this.";
      await fse.writeFile(filePath, originalContent);

      await createProjectFiles(testDir);

      const content = await fse.readFile(filePath, "utf-8");
      expect(content).toBe(originalContent);
    });

    it("does NOT overwrite existing implementation.json", async () => {
      const filePath = join(getRalphDir(testDir), "implementation.json");
      const originalContent = {
        version: 1,
        updatedAt: "2025-01-01T00:00:00.000Z",
        updatedBy: "user",
        specs: [
          {
            id: "existing-spec",
            name: "Existing",
            status: "pending",
            tasks: [],
          },
        ],
        qualityGates: ["custom-gate"],
      };
      await fse.writeJson(filePath, originalContent);

      await createProjectFiles(testDir);

      const content = await fse.readJson(filePath);
      expect(content.specs).toHaveLength(1);
      expect(content.specs[0].id).toBe("existing-spec");
      expect(content.qualityGates).toEqual(["custom-gate"]);
    });

    it("creates example.md in specs directory when empty", async () => {
      await createProjectFiles(testDir);

      const filePath = join(getSpecsDir(testDir), "example.md");
      const exists = await fse.pathExists(filePath);
      expect(exists).toBe(true);
    });

    it("does not create example.md if specs directory has files", async () => {
      const specsDir = getSpecsDir(testDir);
      await fse.writeFile(
        join(specsDir, "existing-spec.md"),
        "# Existing Spec"
      );

      await createProjectFiles(testDir);

      const examplePath = join(specsDir, "example.md");
      const exists = await fse.pathExists(examplePath);
      expect(exists).toBe(false);
    });

    it("adds logs to .gitignore", async () => {
      await createProjectFiles(testDir);

      const gitignorePath = join(testDir, ".gitignore");
      const content = await fse.readFile(gitignorePath, "utf-8");
      expect(content).toContain(`.ralph-wiggum/${RALPH_LOGS_DIR}/`);
    });
  });

  describe("isValidAgentType()", () => {
    it("returns true for valid agent types", () => {
      expect(isValidAgentType("claude")).toBe(true);
      expect(isValidAgentType("amp")).toBe(true);
      expect(isValidAgentType("droid")).toBe(true);
      expect(isValidAgentType("opencode")).toBe(true);
      expect(isValidAgentType("cursor")).toBe(true);
      expect(isValidAgentType("codex")).toBe(true);
      expect(isValidAgentType("gemini")).toBe(true);
      expect(isValidAgentType("pi")).toBe(true);
    });

    it("returns false for invalid agent types", () => {
      expect(isValidAgentType("invalid")).toBe(false);
      expect(isValidAgentType("")).toBe(false);
      expect(isValidAgentType("CLAUDE")).toBe(false);
      expect(isValidAgentType("gpt")).toBe(false);
    });
  });
});

// Tests that require mocking the agents module
describe("init-logic with mocked agents", () => {
  let mockGetAgent: ReturnType<typeof mock>;
  let mockGetAllAgents: ReturnType<typeof mock>;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `ralph-init-mock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fse.ensureDir(testDir);
  });

  afterEach(async () => {
    await fse.remove(testDir);
  });

  describe("checkAgentInstalled()", () => {
    it("returns result with agent name when installed", async () => {
      const mockAgent = {
        name: "Test Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(true),
        getInstallInstructions: () => "",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      // Re-import after mocking
      const { checkAgentInstalled } = await import("../init-logic");

      const result = await checkAgentInstalled("claude");

      expect(result.success).toBe(true);
      expect(result.name).toBe("Test Agent");
    });

    it("returns instructions when agent not installed", async () => {
      const mockAgent = {
        name: "Missing Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(false),
        getInstallInstructions: () => "Install with: npm install test-agent",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { checkAgentInstalled } = await import("../init-logic");

      const result = await checkAgentInstalled("claude");

      expect(result.success).toBe(false);
      expect(result.instructions).toBe("Install with: npm install test-agent");
    });
  });

  describe("initializeProject()", () => {
    it("returns already_initialized error when project exists", async () => {
      await initProject(testDir, {
        planAgent: "claude",
        buildAgent: "claude",
      });

      // Import without mocking agents for this test
      const { initializeProject } = await import("../init-logic");

      const result = await initializeProject({
        projectPath: testDir,
        planAgent: "claude",
        buildAgent: "claude",
      });

      expect(result.success).toBe(false);
      expect(result.alreadyInitialized).toBe(true);
      expect(result.error?.type).toBe("already_initialized");
    });

    it("allows reinit with force flag", async () => {
      await initProject(testDir, {
        planAgent: "claude",
        buildAgent: "claude",
      });

      const mockAgent = {
        name: "Test Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(true),
        getInstallInstructions: () => "",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { initializeProject } = await import("../init-logic");

      const result = await initializeProject({
        projectPath: testDir,
        planAgent: "claude",
        buildAgent: "claude",
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
    });

    it("returns agent_not_installed error for missing plan agent", async () => {
      const mockAgent = {
        name: "Missing Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(false),
        getInstallInstructions: () => "Install instructions here",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { initializeProject } = await import("../init-logic");

      const newTestDir = join(testDir, "new-project");
      await fse.ensureDir(newTestDir);

      const result = await initializeProject({
        projectPath: newTestDir,
        planAgent: "claude",
        buildAgent: "amp",
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe("agent_not_installed");
      expect(result.error?.agentName).toBe("Missing Agent");
      expect(result.error?.installInstructions).toBe(
        "Install instructions here"
      );
    });

    it("creates config with telegram notifications", async () => {
      const mockAgent = {
        name: "Test Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(true),
        getInstallInstructions: () => "",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { initializeProject } = await import("../init-logic");

      const newTestDir = join(testDir, "telegram-project");
      await fse.ensureDir(newTestDir);

      const result = await initializeProject({
        projectPath: newTestDir,
        planAgent: "claude",
        buildAgent: "claude",
        telegramConfig: {
          botToken: "test-token",
          chatId: "test-chat",
          enabled: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.config?.notifications?.telegram?.botToken).toBe(
        "test-token"
      );
      expect(result.config?.notifications?.telegram?.chatId).toBe("test-chat");
    });

    it("creates project files on successful init", async () => {
      const mockAgent = {
        name: "Test Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(true),
        getInstallInstructions: () => "",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { initializeProject } = await import("../init-logic");

      const newTestDir = join(testDir, "files-project");
      await fse.ensureDir(newTestDir);

      const result = await initializeProject({
        projectPath: newTestDir,
        planAgent: "claude",
        buildAgent: "claude",
      });

      expect(result.success).toBe(true);

      const ralphDir = getRalphDir(newTestDir);
      expect(await fse.pathExists(join(ralphDir, "PROMPT_plan.md"))).toBe(true);
      expect(await fse.pathExists(join(ralphDir, "PROGRESS.md"))).toBe(true);
      expect(await fse.pathExists(join(ralphDir, "GUARDRAILS.md"))).toBe(true);
      expect(await fse.pathExists(join(ralphDir, "implementation.json"))).toBe(
        true
      );
    });

    it("stores plan and build models in config", async () => {
      const mockAgent = {
        name: "Test Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(true),
        getInstallInstructions: () => "",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { initializeProject } = await import("../init-logic");

      const newTestDir = join(testDir, "models-project");
      await fse.ensureDir(newTestDir);

      const result = await initializeProject({
        projectPath: newTestDir,
        planAgent: "claude",
        planModel: "opus",
        buildAgent: "amp",
        buildModel: "smart",
      });

      expect(result.success).toBe(true);
      expect(result.config?.agents.plan.agent).toBe("claude");
      expect(result.config?.agents.plan.model).toBe("opus");
      expect(result.config?.agents.build.agent).toBe("amp");
      expect(result.config?.agents.build.model).toBe("smart");
    });
  });

  describe("config.json creation", () => {
    it("creates config.json with correct structure", async () => {
      const mockAgent = {
        name: "Test Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(true),
        getInstallInstructions: () => "",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { initializeProject } = await import("../init-logic");

      const newTestDir = join(testDir, "config-structure-project");
      await fse.ensureDir(newTestDir);

      await initializeProject({
        projectPath: newTestDir,
        planAgent: "claude",
        buildAgent: "claude",
      });

      const configPath = join(getRalphDir(newTestDir), "config.json");
      expect(await fse.pathExists(configPath)).toBe(true);

      const state = await fse.readJson(configPath);
      expect(state).toHaveProperty("config");
      expect(state).toHaveProperty("sessions");
      expect(Array.isArray(state.sessions)).toBe(true);
      expect(state.config).toHaveProperty("projectName");
      expect(state.config).toHaveProperty("agents");
      expect(state.config).toHaveProperty("createdAt");
      expect(state.config).toHaveProperty("updatedAt");
      expect(state.config.agents).toHaveProperty("plan");
      expect(state.config.agents).toHaveProperty("build");
    });

    it("sets correct agent types in config.json", async () => {
      const mockAgent = {
        name: "Test Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(true),
        getInstallInstructions: () => "",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { initializeProject } = await import("../init-logic");

      const newTestDir = join(testDir, "config-agents-project");
      await fse.ensureDir(newTestDir);

      await initializeProject({
        projectPath: newTestDir,
        planAgent: "claude",
        buildAgent: "amp",
      });

      const configPath = join(getRalphDir(newTestDir), "config.json");
      const state = await fse.readJson(configPath);

      expect(state.config.agents.plan.agent).toBe("claude");
      expect(state.config.agents.build.agent).toBe("amp");
    });

    it("includes model when provided in config.json", async () => {
      const mockAgent = {
        name: "Test Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(true),
        getInstallInstructions: () => "",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { initializeProject } = await import("../init-logic");

      const newTestDir = join(testDir, "config-model-project");
      await fse.ensureDir(newTestDir);

      await initializeProject({
        projectPath: newTestDir,
        planAgent: "claude",
        planModel: "opus",
        buildAgent: "amp",
        buildModel: "smart",
      });

      const configPath = join(getRalphDir(newTestDir), "config.json");
      const state = await fse.readJson(configPath);

      expect(state.config.agents.plan.model).toBe("opus");
      expect(state.config.agents.build.model).toBe("smart");
    });

    it("includes telegram config when provided in config.json", async () => {
      const mockAgent = {
        name: "Test Agent",
        type: "claude" as const,
        checkInstalled: () => Promise.resolve(true),
        getInstallInstructions: () => "",
        buildCommand: () => ({ command: "test", args: [] }),
      };

      mockGetAgent = mock(() => mockAgent);
      mockGetAllAgents = mock(() => [mockAgent]);

      mock.module("../../agents/index", () => ({
        getAgent: mockGetAgent,
        getAllAgents: mockGetAllAgents,
      }));

      const { initializeProject } = await import("../init-logic");

      const newTestDir = join(testDir, "config-telegram-project");
      await fse.ensureDir(newTestDir);

      await initializeProject({
        projectPath: newTestDir,
        planAgent: "claude",
        buildAgent: "claude",
        telegramConfig: {
          botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
          chatId: "-1001234567890",
          enabled: true,
        },
      });

      const configPath = join(getRalphDir(newTestDir), "config.json");
      const state = await fse.readJson(configPath);

      expect(state.config.notifications).toBeDefined();
      expect(state.config.notifications.telegram).toBeDefined();
      expect(state.config.notifications.telegram.botToken).toBe(
        "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
      );
      expect(state.config.notifications.telegram.chatId).toBe("-1001234567890");
      expect(state.config.notifications.telegram.enabled).toBe(true);
    });
  });
});
