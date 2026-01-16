import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import fse from "fs-extra";
import {
  appendToLog,
  getAllSpecs,
  getLatestSessionLog,
  markTaskAsStopped,
  parseImplementationPlan,
  readLogContent,
  readSpecContent,
} from "../file-operations";

const TEST_DIR = join(import.meta.dir, ".test-file-ops");

// Top-level regex patterns for lint compliance
const TIMESTAMP_REGEX = /\[\d{4}-\d{2}-\d{2}T.*\] new message/;
const IN_PROGRESS_TASK_REGEX = /## In Progress\n- specs\/running\.md/;

async function setupTestProject(): Promise<void> {
  await fse.ensureDir(join(TEST_DIR, ".ralph-wiggum/specs"));
  await fse.ensureDir(join(TEST_DIR, ".ralph-wiggum/logs"));
}

async function cleanupTestProject(): Promise<void> {
  await fse.remove(TEST_DIR);
}

describe("file-operations", () => {
  beforeEach(async () => {
    await cleanupTestProject();
    await setupTestProject();
  });

  afterEach(async () => {
    await cleanupTestProject();
  });

  describe("parseImplementationPlan", () => {
    test("parses plan from project path", async () => {
      await fse.writeFile(
        join(TEST_DIR, ".ralph-wiggum/IMPLEMENTATION_PLAN.md"),
        `## In Progress
- specs/task.md

## Backlog

## Completed
`
      );

      const result = await parseImplementationPlan(TEST_DIR);
      expect(result.inProgress).toHaveLength(1);
      expect(result.inProgress[0].specPath).toBe("specs/task.md");
    });

    test("returns empty arrays when plan file missing", async () => {
      const result = await parseImplementationPlan(TEST_DIR);
      expect(result.inProgress).toHaveLength(0);
      expect(result.backlog).toHaveLength(0);
      expect(result.completed).toHaveLength(0);
      expect(result.stopped).toHaveLength(0);
    });
  });

  describe("readSpecContent", () => {
    test("returns content for existing spec", async () => {
      await fse.writeFile(
        join(TEST_DIR, ".ralph-wiggum/specs/test.md"),
        "# Test Spec\nContent here."
      );

      const content = await readSpecContent(TEST_DIR, "specs/test.md");
      expect(content).toBe("# Test Spec\nContent here.");
    });

    test("returns not found message for missing spec", async () => {
      const content = await readSpecContent(TEST_DIR, "specs/nonexistent.md");
      expect(content).toContain("Spec Not Found");
      expect(content).toContain("nonexistent.md");
    });
  });

  describe("getAllSpecs", () => {
    test("returns all markdown files in specs directory", async () => {
      await fse.writeFile(
        join(TEST_DIR, ".ralph-wiggum/specs/one.md"),
        "# One"
      );
      await fse.writeFile(
        join(TEST_DIR, ".ralph-wiggum/specs/two.md"),
        "# Two"
      );

      const specs = await getAllSpecs(TEST_DIR);
      expect(specs).toContain("specs/one.md");
      expect(specs).toContain("specs/two.md");
      expect(specs).toHaveLength(2);
    });

    test("returns empty array when specs directory missing", async () => {
      await fse.remove(join(TEST_DIR, ".ralph-wiggum/specs"));
      const specs = await getAllSpecs(TEST_DIR);
      expect(specs).toEqual([]);
    });
  });

  describe("getLatestSessionLog", () => {
    test("returns most recent log file", async () => {
      const logsDir = join(TEST_DIR, ".ralph-wiggum/logs");
      await fse.writeFile(join(logsDir, "old.log"), "old");
      // Wait a bit to ensure different mtime
      await new Promise((r) => setTimeout(r, 50));
      await fse.writeFile(join(logsDir, "new.log"), "new");

      const latestLog = await getLatestSessionLog(TEST_DIR);
      expect(latestLog).toContain("new.log");
    });

    test("returns null when no logs exist", async () => {
      const latestLog = await getLatestSessionLog(TEST_DIR);
      expect(latestLog).toBeNull();
    });

    test("returns null when logs directory missing", async () => {
      await fse.remove(join(TEST_DIR, ".ralph-wiggum/logs"));
      const latestLog = await getLatestSessionLog(TEST_DIR);
      expect(latestLog).toBeNull();
    });
  });

  describe("readLogContent", () => {
    test("returns last N lines of log file", async () => {
      const logPath = join(TEST_DIR, "test.log");
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      await fse.writeFile(logPath, lines.join("\n"));

      const content = await readLogContent(logPath, 10);
      expect(content).toContain("Line 100");
      expect(content).toContain("Line 91");
      expect(content).not.toContain("Line 1\n");
    });

    test("returns not found message for missing file", async () => {
      const content = await readLogContent("/nonexistent/path.log");
      expect(content).toBe("No log file found.");
    });
  });

  describe("appendToLog", () => {
    test("appends timestamped entry to log file", async () => {
      const logPath = join(TEST_DIR, "test.log");
      await fse.writeFile(logPath, "existing content\n");

      await appendToLog(logPath, "new message");

      const content = await fse.readFile(logPath, "utf-8");
      expect(content).toContain("existing content");
      expect(content).toMatch(TIMESTAMP_REGEX);
    });

    test("does nothing when logPath is empty", async () => {
      // Should not throw
      await appendToLog("", "message");
    });
  });

  describe("markTaskAsStopped", () => {
    test("moves task from in progress to backlog with stopped marker", async () => {
      await fse.writeFile(
        join(TEST_DIR, ".ralph-wiggum/IMPLEMENTATION_PLAN.md"),
        `## In Progress
- specs/running.md

## Backlog
- specs/waiting.md

## Completed
`
      );

      await markTaskAsStopped(TEST_DIR, "specs/running.md");

      const content = await fse.readFile(
        join(TEST_DIR, ".ralph-wiggum/IMPLEMENTATION_PLAN.md"),
        "utf-8"
      );

      // Task should no longer be in In Progress as a regular item
      expect(content).not.toMatch(IN_PROGRESS_TASK_REGEX);
      // Task should be in Backlog with stopped marker
      expect(content).toContain("[stopped] specs/running.md");
    });

    test("does nothing when plan file missing", async () => {
      // Should not throw
      await markTaskAsStopped(TEST_DIR, "specs/task.md");
    });

    test("does nothing when task not found in in progress", async () => {
      await fse.writeFile(
        join(TEST_DIR, ".ralph-wiggum/IMPLEMENTATION_PLAN.md"),
        `## In Progress

## Backlog
- specs/task.md

## Completed
`
      );

      await markTaskAsStopped(TEST_DIR, "specs/nonexistent.md");

      // File should be unchanged
      const content = await fse.readFile(
        join(TEST_DIR, ".ralph-wiggum/IMPLEMENTATION_PLAN.md"),
        "utf-8"
      );
      expect(content).not.toContain("[stopped]");
    });
  });
});
