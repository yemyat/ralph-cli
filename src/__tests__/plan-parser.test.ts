import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fse from "fs-extra";
import { getRalphDir } from "../utils/paths";
import {
  extractCurrentSpecFromContent,
  extractSpecName,
  getCurrentSpec,
  getCurrentSpecTitle,
  specNameToTitle,
} from "../utils/plan-parser";

const TEST_DIR = join(
  tmpdir(),
  `ralph-plan-parser-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

describe("Plan Parser Utilities", () => {
  beforeAll(async () => {
    await fse.ensureDir(TEST_DIR);
  });

  afterAll(async () => {
    await fse.remove(TEST_DIR);
  });

  describe("extractSpecName()", () => {
    it("extracts spec name from full path", () => {
      expect(extractSpecName("specs/011-telegram-notifications.md")).toBe(
        "011-telegram-notifications"
      );
    });

    it("extracts spec name with different prefix numbers", () => {
      expect(extractSpecName("specs/001-feature.md")).toBe("001-feature");
      expect(extractSpecName("specs/999-another.md")).toBe("999-another");
    });
  });

  describe("specNameToTitle()", () => {
    it("converts spec name to readable title", () => {
      expect(specNameToTitle("011-telegram-notifications")).toBe(
        "Telegram Notifications"
      );
    });

    it("handles single word spec names", () => {
      expect(specNameToTitle("001-feature")).toBe("Feature");
    });

    it("handles multi-word spec names", () => {
      expect(specNameToTitle("007-extract-task-manager-hook")).toBe(
        "Extract Task Manager Hook"
      );
    });
  });

  describe("extractCurrentSpecFromContent()", () => {
    it("extracts the first spec from In Progress section", () => {
      const content = `# Implementation Plan

## In Progress
- specs/011-telegram-notifications.md

## Backlog
- specs/012-future-feature.md

## Completed
- specs/001-initial.md
`;

      expect(extractCurrentSpecFromContent(content)).toBe(
        "011-telegram-notifications"
      );
    });

    it("returns null when In Progress section is empty", () => {
      const content = `# Implementation Plan

## In Progress
<!-- Currently working on -->

## Backlog
- specs/011-telegram-notifications.md

## Completed
- specs/001-initial.md
`;

      expect(extractCurrentSpecFromContent(content)).toBeNull();
    });

    it("returns null when no spec in In Progress", () => {
      const content = `# Implementation Plan

## In Progress

## Backlog
- specs/011-telegram-notifications.md
`;

      expect(extractCurrentSpecFromContent(content)).toBeNull();
    });

    it("handles markdown link format", () => {
      const content = `# Implementation Plan

## In Progress
- [Telegram Notifications](specs/011-telegram-notifications.md)

## Backlog
`;

      expect(extractCurrentSpecFromContent(content)).toBe(
        "011-telegram-notifications"
      );
    });

    it("handles checkbox format", () => {
      const content = `# Implementation Plan

## In Progress
- [ ] specs/011-telegram-notifications.md

## Backlog
`;

      expect(extractCurrentSpecFromContent(content)).toBe(
        "011-telegram-notifications"
      );
    });

    it("ignores HTML comments", () => {
      const content = `# Implementation Plan

## In Progress
<!-- Specs currently being worked on -->
- specs/011-telegram-notifications.md

## Backlog
`;

      expect(extractCurrentSpecFromContent(content)).toBe(
        "011-telegram-notifications"
      );
    });
  });

  describe("getCurrentSpec()", () => {
    it("reads and parses IMPLEMENTATION_PLAN.md from project", async () => {
      const projectPath = join(TEST_DIR, "test-project-1");
      const ralphDir = getRalphDir(projectPath);
      await fse.ensureDir(ralphDir);

      const planContent = `# Implementation Plan

## In Progress
- specs/011-telegram-notifications.md

## Backlog
- specs/012-future.md

## Completed
`;
      await fse.writeFile(
        join(ralphDir, "IMPLEMENTATION_PLAN.md"),
        planContent
      );

      const result = await getCurrentSpec(projectPath);

      expect(result).toBe("011-telegram-notifications");
    });

    it("returns null when IMPLEMENTATION_PLAN.md does not exist", async () => {
      const projectPath = join(TEST_DIR, "no-plan-project");
      await fse.ensureDir(projectPath);

      const result = await getCurrentSpec(projectPath);

      expect(result).toBeNull();
    });

    it("returns null when In Progress section has no specs", async () => {
      const projectPath = join(TEST_DIR, "empty-in-progress");
      const ralphDir = getRalphDir(projectPath);
      await fse.ensureDir(ralphDir);

      const planContent = `# Implementation Plan

## In Progress

## Backlog
- specs/011-telegram-notifications.md
`;
      await fse.writeFile(
        join(ralphDir, "IMPLEMENTATION_PLAN.md"),
        planContent
      );

      const result = await getCurrentSpec(projectPath);

      expect(result).toBeNull();
    });
  });

  describe("getCurrentSpecTitle()", () => {
    it("extracts title from spec file H1 heading", async () => {
      const projectPath = join(TEST_DIR, "test-project-title");
      const ralphDir = getRalphDir(projectPath);
      await fse.ensureDir(join(ralphDir, "specs"));

      const planContent = `# Implementation Plan

## In Progress
- specs/011-telegram-notifications.md

## Backlog
`;
      await fse.writeFile(
        join(ralphDir, "IMPLEMENTATION_PLAN.md"),
        planContent
      );

      const specContent = `# Telegram Notifications on Iteration Completion

## Problem to solve
As a developer running long Ralph loops...
`;
      await fse.writeFile(
        join(ralphDir, "specs", "011-telegram-notifications.md"),
        specContent
      );

      const result = await getCurrentSpecTitle(projectPath);

      expect(result).toBe("Telegram Notifications on Iteration Completion");
    });

    it("falls back to title conversion when spec file doesn't exist", async () => {
      const projectPath = join(TEST_DIR, "test-project-no-spec-file");
      const ralphDir = getRalphDir(projectPath);
      await fse.ensureDir(ralphDir);

      const planContent = `# Implementation Plan

## In Progress
- specs/011-telegram-notifications.md

## Backlog
`;
      await fse.writeFile(
        join(ralphDir, "IMPLEMENTATION_PLAN.md"),
        planContent
      );

      const result = await getCurrentSpecTitle(projectPath);

      expect(result).toBe("Telegram Notifications");
    });

    it("falls back to title conversion when spec has no H1 heading", async () => {
      const projectPath = join(TEST_DIR, "test-project-no-heading");
      const ralphDir = getRalphDir(projectPath);
      await fse.ensureDir(join(ralphDir, "specs"));

      const planContent = `# Implementation Plan

## In Progress
- specs/011-feature.md

## Backlog
`;
      await fse.writeFile(
        join(ralphDir, "IMPLEMENTATION_PLAN.md"),
        planContent
      );

      const specContent = `Some content without a proper heading.

## Problem to solve
`;
      await fse.writeFile(
        join(ralphDir, "specs", "011-feature.md"),
        specContent
      );

      const result = await getCurrentSpecTitle(projectPath);

      expect(result).toBe("Feature");
    });

    it("returns null when no spec in progress", async () => {
      const projectPath = join(TEST_DIR, "test-project-no-in-progress");
      const ralphDir = getRalphDir(projectPath);
      await fse.ensureDir(ralphDir);

      const planContent = `# Implementation Plan

## In Progress

## Backlog
- specs/011-telegram-notifications.md
`;
      await fse.writeFile(
        join(ralphDir, "IMPLEMENTATION_PLAN.md"),
        planContent
      );

      const result = await getCurrentSpecTitle(projectPath);

      expect(result).toBeNull();
    });
  });
});
