import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  getConfigFile,
  getLogsDir,
  getRalphDir,
  getSessionLogFile,
  getSpecsDir,
  RALPH_CONFIG_FILE,
  RALPH_DIR_NAME,
  RALPH_LOGS_DIR,
} from "../utils/paths.js";

describe("Path Utilities", () => {
  describe("Constants", () => {
    it("RALPH_DIR_NAME is .ralph-wiggum", () => {
      expect(RALPH_DIR_NAME).toBe(".ralph-wiggum");
    });

    it("RALPH_CONFIG_FILE is config.json", () => {
      expect(RALPH_CONFIG_FILE).toBe("config.json");
    });

    it("RALPH_LOGS_DIR is logs", () => {
      expect(RALPH_LOGS_DIR).toBe("logs");
    });
  });

  describe("getRalphDir()", () => {
    it("returns .ralph-wiggum in project path", () => {
      const projectPath = "/Users/test/my-project";
      const dir = getRalphDir(projectPath);

      expect(dir).toBe(join(projectPath, ".ralph-wiggum"));
    });
  });

  describe("getConfigFile()", () => {
    it("returns config.json in .ralph-wiggum", () => {
      const projectPath = "/Users/test/my-project";
      const configFile = getConfigFile(projectPath);

      expect(configFile).toBe(
        join(projectPath, ".ralph-wiggum", "config.json")
      );
    });
  });

  describe("getLogsDir()", () => {
    it("returns logs folder in .ralph-wiggum", () => {
      const projectPath = "/Users/test/my-project";
      const logsDir = getLogsDir(projectPath);

      expect(logsDir).toBe(join(projectPath, ".ralph-wiggum", "logs"));
    });
  });

  describe("getSessionLogFile()", () => {
    it("returns correct path for session ID", () => {
      const projectPath = "/Users/test/my-project";
      const sessionId = "session-12345";
      const logFile = getSessionLogFile(projectPath, sessionId);

      expect(logFile).toBe(
        join(projectPath, ".ralph-wiggum", "logs", "session-12345.log")
      );
    });

    it("appends .log extension", () => {
      const logFile = getSessionLogFile("/project", "my-session");

      expect(logFile.endsWith(".log")).toBe(true);
    });
  });

  describe("getSpecsDir()", () => {
    it("returns specs folder in .ralph-wiggum", () => {
      const projectPath = "/Users/test/my-project";
      const specsDir = getSpecsDir(projectPath);

      expect(specsDir).toBe(join(projectPath, ".ralph-wiggum", "specs"));
    });
  });
});
