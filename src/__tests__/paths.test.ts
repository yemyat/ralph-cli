import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  getProjectDir,
  getProjectId,
  getSessionLogFile,
  RALPH_CONFIG_FILE,
  RALPH_HOME,
  RALPH_LOGS_DIR,
  RALPH_PROJECTS_DIR,
} from "../utils/paths.js";

// Top-level regex for hex string validation to satisfy biome's performance rule
const HEX_STRING_REGEX = /^[a-f0-9]+$/;

describe("Path Utilities", () => {
  describe("Constants", () => {
    it("RALPH_HOME is in user home directory", () => {
      expect(RALPH_HOME).toBe(join(homedir(), ".ralph"));
    });

    it("RALPH_CONFIG_FILE is config.json in RALPH_HOME", () => {
      expect(RALPH_CONFIG_FILE).toBe(join(homedir(), ".ralph", "config.json"));
    });

    it("RALPH_PROJECTS_DIR is projects folder in RALPH_HOME", () => {
      expect(RALPH_PROJECTS_DIR).toBe(join(homedir(), ".ralph", "projects"));
    });

    it("RALPH_LOGS_DIR is logs folder in RALPH_HOME", () => {
      expect(RALPH_LOGS_DIR).toBe(join(homedir(), ".ralph", "logs"));
    });
  });

  describe("getProjectId()", () => {
    it("generates consistent IDs for the same path", () => {
      const path = "/Users/test/my-project";
      const id1 = getProjectId(path);
      const id2 = getProjectId(path);

      expect(id1).toBe(id2);
    });

    it("generates different IDs for different paths", () => {
      const id1 = getProjectId("/Users/test/project-a");
      const id2 = getProjectId("/Users/test/project-b");

      expect(id1).not.toBe(id2);
    });

    it("returns 12 character hex string", () => {
      const id = getProjectId("/some/random/path");

      expect(id.length).toBe(12);
      expect(HEX_STRING_REGEX.test(id)).toBe(true);
    });

    it("handles paths with special characters", () => {
      const id = getProjectId("/Users/test/my project with spaces");

      expect(id.length).toBe(12);
      expect(HEX_STRING_REGEX.test(id)).toBe(true);
    });

    it("handles empty path", () => {
      const id = getProjectId("");

      expect(id.length).toBe(12);
      expect(HEX_STRING_REGEX.test(id)).toBe(true);
    });

    it("is case-sensitive", () => {
      const id1 = getProjectId("/Users/Test/Project");
      const id2 = getProjectId("/Users/test/project");

      expect(id1).not.toBe(id2);
    });
  });

  describe("getProjectDir()", () => {
    it("returns correct path for project ID", () => {
      const projectId = "abc123def456";
      const dir = getProjectDir(projectId);

      expect(dir).toBe(join(homedir(), ".ralph", "projects", projectId));
    });
  });

  describe("getSessionLogFile()", () => {
    it("returns correct path for session ID", () => {
      const sessionId = "session-12345";
      const logFile = getSessionLogFile(sessionId);

      expect(logFile).toBe(
        join(homedir(), ".ralph", "logs", "session-12345.log")
      );
    });

    it("appends .log extension", () => {
      const logFile = getSessionLogFile("my-session");

      expect(logFile.endsWith(".log")).toBe(true);
    });
  });
});
