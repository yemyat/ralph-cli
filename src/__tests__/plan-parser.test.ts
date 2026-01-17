import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fse from "fs-extra";
import { getRalphDir } from "../utils/paths";
import {
  extractCurrentSpecFromContent,
  extractSpecName,
  getCurrentSpec,
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
});
