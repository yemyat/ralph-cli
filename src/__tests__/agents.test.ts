import { describe, expect, it } from "bun:test";
import type { AgentOptions } from "../agents/base.js";
import {
  AmpAgent,
  ClaudeAgent,
  DroidAgent,
  getAgent,
  getAllAgents,
} from "../agents/index.js";

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
    });

    describe("getAllAgents()", () => {
      it("returns all three agents", () => {
        const agents = getAllAgents();
        expect(agents.length).toBe(3);

        const types = agents.map((a) => a.type);
        expect(types).toContain("claude");
        expect(types).toContain("amp");
        expect(types).toContain("droid");
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
  });
});
