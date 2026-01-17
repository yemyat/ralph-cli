import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fse from "fs-extra";
import { initProject } from "../config";
import { PROMPT_PLAN, SPEC_TEMPLATE } from "../templates/prompts";
import { getRalphDir, getSpecsDir } from "../utils/paths";

const TEST_DIR = join(
  tmpdir(),
  `ralph-reinit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

async function reinitPrompts(projectPath: string): Promise<boolean> {
  const ralphDir = getRalphDir(projectPath);
  const configPath = join(ralphDir, "config.json");

  if (!(await fse.pathExists(configPath))) {
    return false;
  }

  const specsDir = getSpecsDir(projectPath);
  await fse.writeFile(join(ralphDir, "PROMPT_plan.md"), PROMPT_PLAN);
  await fse.writeFile(join(specsDir, "example.md"), SPEC_TEMPLATE);

  return true;
}

describe("Reinit Command", () => {
  beforeAll(async () => {
    await fse.ensureDir(TEST_DIR);
  });

  afterAll(async () => {
    await fse.remove(TEST_DIR);
  });

  describe("reinitPrompts()", () => {
    it("returns false for uninitialized projects", async () => {
      const projectPath = join(TEST_DIR, "uninit-project");
      await fse.ensureDir(projectPath);

      const result = await reinitPrompts(projectPath);

      expect(result).toBe(false);
    });

    it("updates prompts for initialized projects", async () => {
      const projectPath = join(TEST_DIR, "init-project");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "claude",
        buildAgent: "claude",
      });

      const ralphDir = getRalphDir(projectPath);
      const specsDir = getSpecsDir(projectPath);
      await fse.ensureDir(specsDir);

      await fse.writeFile(join(ralphDir, "PROMPT_plan.md"), "old content");

      const result = await reinitPrompts(projectPath);

      expect(result).toBe(true);

      const planContent = await fse.readFile(
        join(ralphDir, "PROMPT_plan.md"),
        "utf-8"
      );

      expect(planContent).toBe(PROMPT_PLAN);
    });

    it("creates example.md in specs directory", async () => {
      const projectPath = join(TEST_DIR, "specs-project");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "amp",
        buildAgent: "amp",
      });

      const specsDir = getSpecsDir(projectPath);
      await fse.ensureDir(specsDir);

      const result = await reinitPrompts(projectPath);

      expect(result).toBe(true);

      const exampleExists = await fse.pathExists(join(specsDir, "example.md"));
      expect(exampleExists).toBe(true);

      const exampleContent = await fse.readFile(
        join(specsDir, "example.md"),
        "utf-8"
      );
      expect(exampleContent).toBe(SPEC_TEMPLATE);
    });

    it("overwrites existing example.md", async () => {
      const projectPath = join(TEST_DIR, "overwrite-project");
      await fse.ensureDir(projectPath);

      await initProject(projectPath, {
        planAgent: "droid",
        buildAgent: "droid",
      });

      const specsDir = getSpecsDir(projectPath);
      await fse.ensureDir(specsDir);
      await fse.writeFile(join(specsDir, "example.md"), "custom content");

      const result = await reinitPrompts(projectPath);

      expect(result).toBe(true);

      const exampleContent = await fse.readFile(
        join(specsDir, "example.md"),
        "utf-8"
      );
      expect(exampleContent).toBe(SPEC_TEMPLATE);
    });
  });
});
