import { describe, expect, it } from "bun:test";
import { AmpAgent } from "../agents/amp";
import type { AgentOptions } from "../agents/base";
import { ClaudeAgent } from "../agents/claude";
import { CodexAgent } from "../agents/codex";
import { CursorAgent } from "../agents/cursor";
import { DroidAgent } from "../agents/droid";
import { GeminiAgent } from "../agents/gemini";
import { getAgent, getAllAgents } from "../agents/index";
import { OpenCodeAgent } from "../agents/opencode";

describe("Agent Module", () => {
  describe("Agent Registry", () => {
    describe("getAgent()", () => {
      it("returns ClaudeAgent for 'claude'", () => {
        const agent = getAgent("claude");
        expect(agent).toBeInstanceOf(ClaudeAgent);
        expect(agent.type).toBe("claude");
        expect(agent.name).toBe("Claude Code");
      });

      it("returns AmpAgent for 'amp'", () => {
        const agent = getAgent("amp");
        expect(agent).toBeInstanceOf(AmpAgent);
        expect(agent.type).toBe("amp");
        expect(agent.name).toBe("Amp Code");
      });

      it("returns DroidAgent for 'droid'", () => {
        const agent = getAgent("droid");
        expect(agent).toBeInstanceOf(DroidAgent);
        expect(agent.type).toBe("droid");
        expect(agent.name).toBe("Factory Droid");
      });

      it("returns OpenCodeAgent for 'opencode'", () => {
        const agent = getAgent("opencode");
        expect(agent).toBeInstanceOf(OpenCodeAgent);
        expect(agent.type).toBe("opencode");
        expect(agent.name).toBe("OpenCode");
      });

      it("returns CursorAgent for 'cursor'", () => {
        const agent = getAgent("cursor");
        expect(agent).toBeInstanceOf(CursorAgent);
        expect(agent.type).toBe("cursor");
        expect(agent.name).toBe("Cursor Agent");
      });

      it("returns CodexAgent for 'codex'", () => {
        const agent = getAgent("codex");
        expect(agent).toBeInstanceOf(CodexAgent);
        expect(agent.type).toBe("codex");
        expect(agent.name).toBe("OpenAI Codex");
      });

      it("returns GeminiAgent for 'gemini'", () => {
        const agent = getAgent("gemini");
        expect(agent).toBeInstanceOf(GeminiAgent);
        expect(agent.type).toBe("gemini");
        expect(agent.name).toBe("Gemini CLI");
      });
    });

    describe("getAllAgents()", () => {
      it("returns all seven agents", () => {
        const agents = getAllAgents();
        expect(agents.length).toBe(7);

        const types = agents.map((a) => a.type);
        expect(types).toContain("claude");
        expect(types).toContain("amp");
        expect(types).toContain("droid");
        expect(types).toContain("opencode");
        expect(types).toContain("cursor");
        expect(types).toContain("codex");
        expect(types).toContain("gemini");
      });
    });
  });

  describe("ClaudeAgent", () => {
    const agent = new ClaudeAgent();
    const baseOptions: AgentOptions = {
      promptFile: "/path/to/prompt.md",
    };

    describe("buildCommand()", () => {
      it("generates correct base CLI args", () => {
        const cmd = agent.buildCommand(baseOptions);

        expect(cmd.command).toBe("claude");
        expect(cmd.args).toContain("-p");
        expect(cmd.args).toContain("--dangerously-skip-permissions");
        expect(cmd.args).toContain("--output-format=stream-json");
      });

      it("includes model flag when specified", () => {
        const cmd = agent.buildCommand({ ...baseOptions, model: "opus" });

        expect(cmd.args).toContain("--model");
        expect(cmd.args).toContain("opus");
      });

      it("includes verbose flag when specified", () => {
        const cmd = agent.buildCommand({ ...baseOptions, verbose: true });

        expect(cmd.args).toContain("--verbose");
      });
    });

    it("getInstallInstructions() returns non-empty string", () => {
      const instructions = agent.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions).toContain("claude");
    });
  });

  describe("AmpAgent", () => {
    const agent = new AmpAgent();
    const baseOptions: AgentOptions = {
      promptFile: "/path/to/prompt.md",
    };

    describe("buildCommand()", () => {
      it("generates correct base CLI args", () => {
        const cmd = agent.buildCommand(baseOptions);

        expect(cmd.command).toBe("amp");
        expect(cmd.args).toContain("--execute");
        expect(cmd.args).toContain("--stream-json");
      });

      it("includes mode flag for 'smart' model", () => {
        const cmd = agent.buildCommand({ ...baseOptions, model: "smart" });

        expect(cmd.args).toContain("--mode");
        expect(cmd.args).toContain("smart");
      });

      it("includes mode flag for 'rush' model", () => {
        const cmd = agent.buildCommand({ ...baseOptions, model: "rush" });

        expect(cmd.args).toContain("--mode");
        expect(cmd.args).toContain("rush");
      });

      it("does not include mode for other model values", () => {
        const cmd = agent.buildCommand({ ...baseOptions, model: "custom" });

        expect(cmd.args).not.toContain("--mode");
        expect(cmd.args).not.toContain("custom");
      });
    });

    it("getInstallInstructions() returns non-empty string", () => {
      const instructions = agent.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions).toContain("amp");
    });
  });

  describe("DroidAgent", () => {
    const agent = new DroidAgent();
    const baseOptions: AgentOptions = {
      promptFile: "/path/to/prompt.md",
    };

    describe("buildCommand()", () => {
      it("generates correct base CLI args", () => {
        const cmd = agent.buildCommand(baseOptions);

        expect(cmd.command).toBe("droid");
        expect(cmd.args).toContain("exec");
        expect(cmd.args).toContain("--skip-permissions-unsafe");
        expect(cmd.args).toContain("-o");
        expect(cmd.args).toContain("stream-json");
      });

      it("includes model flag when specified", () => {
        const cmd = agent.buildCommand({
          ...baseOptions,
          model: "claude-opus-4",
        });

        expect(cmd.args).toContain("-m");
        expect(cmd.args).toContain("claude-opus-4");
      });
    });

    it("getInstallInstructions() returns non-empty string", () => {
      const instructions = agent.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions).toContain("droid");
    });
  });

  describe("OpenCodeAgent", () => {
    const agent = new OpenCodeAgent();
    const baseOptions: AgentOptions = {
      promptFile: "/path/to/prompt.md",
    };

    describe("buildCommand()", () => {
      it("generates correct base CLI args", () => {
        const cmd = agent.buildCommand(baseOptions);

        expect(cmd.command).toBe("opencode");
        expect(cmd.args).toContain("run");
        expect(cmd.args).toContain("--format");
        expect(cmd.args).toContain("json");
      });

      it("includes model flag when specified", () => {
        const cmd = agent.buildCommand({
          ...baseOptions,
          model: "anthropic/claude-sonnet-4",
        });

        expect(cmd.args).toContain("--model");
        expect(cmd.args).toContain("anthropic/claude-sonnet-4");
      });
    });

    it("getInstallInstructions() returns non-empty string", () => {
      const instructions = agent.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions).toContain("opencode");
    });
  });

  describe("CursorAgent", () => {
    const agent = new CursorAgent();
    const baseOptions: AgentOptions = {
      promptFile: "/path/to/prompt.md",
    };

    describe("buildCommand()", () => {
      it("generates correct base CLI args", () => {
        const cmd = agent.buildCommand(baseOptions);

        expect(cmd.command).toBe("agent");
        expect(cmd.args).toContain("-p");
        expect(cmd.args).toContain("--output-format");
        expect(cmd.args).toContain("stream-json");
        expect(cmd.args).toContain("-f");
        expect(cmd.args).toContain("--approve-mcps");
      });

      it("includes model flag when specified", () => {
        const cmd = agent.buildCommand({
          ...baseOptions,
          model: "gpt-5",
        });

        expect(cmd.args).toContain("--model");
        expect(cmd.args).toContain("gpt-5");
      });
    });

    it("getInstallInstructions() returns non-empty string", () => {
      const instructions = agent.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions).toContain("cursor");
    });
  });

  describe("CodexAgent", () => {
    const agent = new CodexAgent();
    const baseOptions: AgentOptions = {
      promptFile: "/path/to/prompt.md",
    };

    describe("buildCommand()", () => {
      it("generates correct base CLI args", () => {
        const cmd = agent.buildCommand(baseOptions);

        expect(cmd.command).toBe("codex");
        expect(cmd.args).toContain("exec");
        expect(cmd.args).toContain("--json");
        expect(cmd.args).toContain(
          "--dangerously-bypass-approvals-and-sandbox"
        );
      });

      it("includes model flag when specified", () => {
        const cmd = agent.buildCommand({
          ...baseOptions,
          model: "gpt-5-codex",
        });

        expect(cmd.args).toContain("--model");
        expect(cmd.args).toContain("gpt-5-codex");
      });
    });

    it("getInstallInstructions() returns non-empty string", () => {
      const instructions = agent.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions).toContain("codex");
    });
  });

  describe("GeminiAgent", () => {
    const agent = new GeminiAgent();
    const baseOptions: AgentOptions = {
      promptFile: "/path/to/prompt.md",
    };

    describe("buildCommand()", () => {
      it("generates correct base CLI args", () => {
        const cmd = agent.buildCommand(baseOptions);

        expect(cmd.command).toBe("gemini");
        expect(cmd.args).toContain("--output-format");
        expect(cmd.args).toContain("stream-json");
        expect(cmd.args).toContain("--yolo");
      });

      it("includes model flag when specified", () => {
        const cmd = agent.buildCommand({
          ...baseOptions,
          model: "gemini-2.5-pro",
        });

        expect(cmd.args).toContain("--model");
        expect(cmd.args).toContain("gemini-2.5-pro");
      });
    });

    it("getInstallInstructions() returns non-empty string", () => {
      const instructions = agent.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions).toContain("gemini");
    });
  });

  describe("checkInstalled()", () => {
    // Note: These tests check the actual installed state of agents on the system
    // In a CI environment, these may all return false, which is still valid behavior

    it("ClaudeAgent.checkInstalled() returns boolean", async () => {
      const agent = new ClaudeAgent();
      const result = await agent.checkInstalled();
      expect(typeof result).toBe("boolean");
    });

    it("AmpAgent.checkInstalled() returns boolean", async () => {
      const agent = new AmpAgent();
      const result = await agent.checkInstalled();
      expect(typeof result).toBe("boolean");
    });

    it("DroidAgent.checkInstalled() returns boolean", async () => {
      const agent = new DroidAgent();
      const result = await agent.checkInstalled();
      expect(typeof result).toBe("boolean");
    });

    it("OpenCodeAgent.checkInstalled() returns boolean", async () => {
      const agent = new OpenCodeAgent();
      const result = await agent.checkInstalled();
      expect(typeof result).toBe("boolean");
    });

    it("CursorAgent.checkInstalled() returns boolean", async () => {
      const agent = new CursorAgent();
      const result = await agent.checkInstalled();
      expect(typeof result).toBe("boolean");
    });

    it("CodexAgent.checkInstalled() returns boolean", async () => {
      const agent = new CodexAgent();
      const result = await agent.checkInstalled();
      expect(typeof result).toBe("boolean");
    });

    it("GeminiAgent.checkInstalled() returns boolean", async () => {
      const agent = new GeminiAgent();
      const result = await agent.checkInstalled();
      expect(typeof result).toBe("boolean");
    });
  });
});
