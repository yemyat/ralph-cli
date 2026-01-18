import { describe, expect, test } from "bun:test";
import { Spec } from "../domain/spec";
import type { SpecEntry, TaskEntry } from "../types";

describe("Spec", () => {
  const createTaskEntry = (overrides: Partial<TaskEntry> = {}): TaskEntry => ({
    id: "task-1",
    description: "Test task description",
    status: "pending",
    acceptanceCriteria: ["Criterion 1"],
    ...overrides,
  });

  const createSpecEntry = (overrides: Partial<SpecEntry> = {}): SpecEntry => ({
    id: "spec-1",
    file: "test-spec.md",
    name: "Test Spec",
    priority: 1,
    status: "pending",
    context: "Test context",
    tasks: [
      createTaskEntry({ id: "task-1", description: "First task" }),
      createTaskEntry({ id: "task-2", description: "Second task" }),
      createTaskEntry({ id: "task-3", description: "Third task" }),
    ],
    acceptanceCriteria: ["Spec criterion 1", "Spec criterion 2"],
    ...overrides,
  });

  test("isCompleted is true when all tasks complete", () => {
    const specWithPending = new Spec(createSpecEntry());
    expect(specWithPending.isCompleted).toBe(false);

    const specWithAllComplete = new Spec(
      createSpecEntry({
        tasks: [
          createTaskEntry({ id: "task-1", status: "completed" }),
          createTaskEntry({ id: "task-2", status: "completed" }),
          createTaskEntry({ id: "task-3", status: "completed" }),
        ],
      })
    );
    expect(specWithAllComplete.isCompleted).toBe(true);

    // Edge case: one task still pending
    const specWithOnePending = new Spec(
      createSpecEntry({
        tasks: [
          createTaskEntry({ id: "task-1", status: "completed" }),
          createTaskEntry({ id: "task-2", status: "pending" }),
          createTaskEntry({ id: "task-3", status: "completed" }),
        ],
      })
    );
    expect(specWithOnePending.isCompleted).toBe(false);

    // Edge case: empty tasks should be false (not vacuously true)
    const specWithNoTasks = new Spec(createSpecEntry({ tasks: [] }));
    expect(specWithNoTasks.isCompleted).toBe(false);
  });

  test("nextPendingTask returns first pending task", () => {
    const spec = new Spec(
      createSpecEntry({
        tasks: [
          createTaskEntry({
            id: "task-1",
            description: "Completed task",
            status: "completed",
          }),
          createTaskEntry({
            id: "task-2",
            description: "First pending task",
            status: "pending",
          }),
          createTaskEntry({
            id: "task-3",
            description: "Second pending task",
            status: "pending",
          }),
        ],
      })
    );

    const nextTask = spec.nextPendingTask;
    expect(nextTask).toBeDefined();
    expect(nextTask?.id).toBe("task-2");
    expect(nextTask?.description).toBe("First pending task");

    // All completed: should return undefined
    const specAllComplete = new Spec(
      createSpecEntry({
        tasks: [
          createTaskEntry({ id: "task-1", status: "completed" }),
          createTaskEntry({ id: "task-2", status: "completed" }),
        ],
      })
    );
    expect(specAllComplete.nextPendingTask).toBeUndefined();

    // Empty tasks: should return undefined
    const specNoTasks = new Spec(createSpecEntry({ tasks: [] }));
    expect(specNoTasks.nextPendingTask).toBeUndefined();
  });

  test("progress returns correct counts", () => {
    const specPartial = new Spec(
      createSpecEntry({
        tasks: [
          createTaskEntry({ id: "task-1", status: "completed" }),
          createTaskEntry({ id: "task-2", status: "completed" }),
          createTaskEntry({ id: "task-3", status: "pending" }),
          createTaskEntry({ id: "task-4", status: "blocked" }),
        ],
      })
    );

    const progress = specPartial.progress;
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.percentage).toBe(50);

    // All completed
    const specComplete = new Spec(
      createSpecEntry({
        tasks: [
          createTaskEntry({ id: "task-1", status: "completed" }),
          createTaskEntry({ id: "task-2", status: "completed" }),
        ],
      })
    );
    expect(specComplete.progress).toEqual({
      completed: 2,
      total: 2,
      percentage: 100,
    });

    // None completed
    const specNone = new Spec(
      createSpecEntry({
        tasks: [
          createTaskEntry({ id: "task-1", status: "pending" }),
          createTaskEntry({ id: "task-2", status: "pending" }),
          createTaskEntry({ id: "task-3", status: "pending" }),
        ],
      })
    );
    expect(specNone.progress).toEqual({
      completed: 0,
      total: 3,
      percentage: 0,
    });

    // Empty tasks: avoid division by zero
    const specEmpty = new Spec(createSpecEntry({ tasks: [] }));
    expect(specEmpty.progress).toEqual({
      completed: 0,
      total: 0,
      percentage: 0,
    });
  });

  test("checkCompletion() returns correct status counts", () => {
    const spec = new Spec(
      createSpecEntry({
        tasks: [
          createTaskEntry({ id: "task-1", status: "completed" }),
          createTaskEntry({ id: "task-2", status: "pending" }),
          createTaskEntry({ id: "task-3", status: "pending" }),
          createTaskEntry({ id: "task-4", status: "blocked" }),
          createTaskEntry({ id: "task-5", status: "blocked" }),
        ],
      })
    );

    const result = spec.checkCompletion();
    expect(result.isComplete).toBe(false);
    expect(result.pendingCount).toBe(2);
    expect(result.blockedCount).toBe(2);

    // All completed
    const specComplete = new Spec(
      createSpecEntry({
        tasks: [
          createTaskEntry({ id: "task-1", status: "completed" }),
          createTaskEntry({ id: "task-2", status: "completed" }),
        ],
      })
    );

    const completeResult = specComplete.checkCompletion();
    expect(completeResult.isComplete).toBe(true);
    expect(completeResult.pendingCount).toBe(0);
    expect(completeResult.blockedCount).toBe(0);
  });

  test("toJSON() includes updated tasks", () => {
    const spec = new Spec(
      createSpecEntry({
        id: "spec-json",
        file: "json-spec.md",
        name: "JSON Test Spec",
        priority: 2,
        context: "JSON context",
        tasks: [
          createTaskEntry({
            id: "task-1",
            description: "First task",
            status: "completed",
          }),
          createTaskEntry({
            id: "task-2",
            description: "Second task",
            status: "pending",
          }),
        ],
        acceptanceCriteria: ["JSON criterion"],
      })
    );

    // Mutate a task through the tasks array
    const tasks = spec.tasks;
    tasks[1].complete();

    const json = spec.toJSON();

    // Verify spec-level fields
    expect(json.id).toBe("spec-json");
    expect(json.file).toBe("json-spec.md");
    expect(json.name).toBe("JSON Test Spec");
    expect(json.priority).toBe(2);
    expect(json.context).toBe("JSON context");
    expect(json.acceptanceCriteria).toEqual(["JSON criterion"]);

    // Verify status is computed from tasks
    expect(json.status).toBe("completed");

    // Verify tasks are serialized with updated status
    expect(json.tasks).toHaveLength(2);
    expect(json.tasks[0].status).toBe("completed");
    expect(json.tasks[1].status).toBe("completed");
    expect(json.tasks[1].completedAt).toBeDefined();

    // Verify it's a plain object
    expect(json.constructor).toBe(Object);
    expect(json).not.toBeInstanceOf(Spec);
  });
});
