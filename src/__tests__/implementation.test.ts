import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fse from "fs-extra";
import { Implementation } from "../domain/implementation";
import type { Implementation as ImplementationData, SpecEntry } from "../types";
import { getImplementationFile, getRalphDir } from "../utils/paths";

describe("Implementation", () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), "ralph-impl-test-"));
    await mkdir(getRalphDir(testDir), { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  const createSpecEntry = (overrides: Partial<SpecEntry> = {}): SpecEntry => ({
    id: "spec-1",
    file: "test-spec.md",
    name: "Test Spec",
    priority: 1,
    status: "pending",
    context: "Test context",
    tasks: [
      {
        id: "task-1",
        description: "First task",
        status: "pending",
        acceptanceCriteria: ["Criterion 1"],
      },
      {
        id: "task-2",
        description: "Second task",
        status: "pending",
        acceptanceCriteria: ["Criterion 2"],
      },
    ],
    acceptanceCriteria: ["Spec criterion"],
    ...overrides,
  });

  const createImplData = (
    overrides: Partial<ImplementationData> = {}
  ): ImplementationData => ({
    version: 1,
    updatedAt: "2026-01-18T10:00:00.000Z",
    updatedBy: "user",
    specs: [createSpecEntry()],
    qualityGates: ["bun run typecheck"],
    ...overrides,
  });

  test("load() returns Implementation instance", async () => {
    const implPath = getImplementationFile(testDir);
    const data = createImplData({
      updatedBy: "plan-mode",
      specs: [
        createSpecEntry({ id: "spec-a", name: "Spec A" }),
        createSpecEntry({ id: "spec-b", name: "Spec B" }),
      ],
    });
    await fse.writeJson(implPath, data, { spaces: 2 });

    const impl = await Implementation.load(testDir);

    expect(impl).toBeInstanceOf(Implementation);
    expect(impl).not.toBeNull();

    if (!impl) {
      throw new Error("impl should not be null");
    }

    expect(impl.version).toBe(1);
    expect(impl.updatedBy).toBe("plan-mode");
    expect(impl.specs).toHaveLength(2);
    expect(impl.specs[0].id).toBe("spec-a");
    expect(impl.specs[1].id).toBe("spec-b");
    expect(impl.projectPath).toBe(testDir);
  });

  test("load() returns null if file missing", async () => {
    // Use a non-existent directory
    const nonExistentDir = join(testDir, "does-not-exist");

    const impl = await Implementation.load(nonExistentDir);

    expect(impl).toBeNull();
  });

  test("nextPendingTask returns first pending across specs", () => {
    const data = createImplData({
      specs: [
        createSpecEntry({
          id: "spec-1",
          name: "First Spec",
          tasks: [
            {
              id: "task-1-1",
              description: "Completed task",
              status: "completed",
              acceptanceCriteria: ["Done"],
            },
            {
              id: "task-1-2",
              description: "Another completed",
              status: "completed",
              acceptanceCriteria: ["Done"],
            },
          ],
        }),
        createSpecEntry({
          id: "spec-2",
          name: "Second Spec",
          tasks: [
            {
              id: "task-2-1",
              description: "First pending in second spec",
              status: "pending",
              acceptanceCriteria: ["TODO"],
            },
            {
              id: "task-2-2",
              description: "Second pending",
              status: "pending",
              acceptanceCriteria: ["TODO"],
            },
          ],
        }),
      ],
    });

    const impl = new Implementation(testDir, data);

    const next = impl.nextPendingTask;
    expect(next).toBeDefined();

    if (!next) {
      throw new Error("next should not be undefined");
    }

    expect(next.spec.id).toBe("spec-2");
    expect(next.task.id).toBe("task-2-1");
    expect(next.task.description).toBe("First pending in second spec");

    // Edge case: all completed should return undefined
    const allCompletedData = createImplData({
      specs: [
        createSpecEntry({
          id: "spec-done",
          tasks: [
            {
              id: "task-done",
              description: "Done",
              status: "completed",
              acceptanceCriteria: ["Done"],
            },
          ],
        }),
      ],
    });
    const implAllDone = new Implementation(testDir, allCompletedData);
    expect(implAllDone.nextPendingTask).toBeUndefined();
  });

  test("save() persists changes to disk", async () => {
    // Create a separate subdirectory for this test to avoid conflicts
    const saveTestDir = join(testDir, "save-test");
    await mkdir(getRalphDir(saveTestDir), { recursive: true });

    const data = createImplData({
      updatedBy: "user",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const impl = new Implementation(saveTestDir, data);

    // Save with different updatedBy
    const beforeSave = new Date();
    await impl.save("build-mode");
    const afterSave = new Date();

    // Read back from disk
    const implPath = getImplementationFile(saveTestDir);
    const savedData = await fse.readJson(implPath);

    expect(savedData.updatedBy).toBe("build-mode");
    expect(savedData.version).toBe(1);
    expect(savedData.specs).toHaveLength(1);

    // Verify updatedAt was updated to a recent timestamp
    const savedUpdatedAt = new Date(savedData.updatedAt);
    expect(savedUpdatedAt.getTime()).toBeGreaterThanOrEqual(
      beforeSave.getTime()
    );
    expect(savedUpdatedAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
  });

  test("toJSON() includes updatedAt", () => {
    const data = createImplData({
      updatedAt: "2026-01-18T12:30:00.000Z",
      updatedBy: "build-mode",
      qualityGates: ["bun run test", "bun run lint"],
    });
    const impl = new Implementation(testDir, data);

    const json = impl.toJSON();

    // Verify updatedAt is included
    expect(json.updatedAt).toBe("2026-01-18T12:30:00.000Z");

    // Verify other fields are also correct
    expect(json.version).toBe(1);
    expect(json.updatedBy).toBe("build-mode");
    expect(json.specs).toHaveLength(1);
    expect(json.qualityGates).toEqual(["bun run test", "bun run lint"]);

    // Verify it's a plain object
    expect(json.constructor).toBe(Object);
    expect(json).not.toBeInstanceOf(Implementation);
  });
});
