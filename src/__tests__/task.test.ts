import { describe, expect, test } from "bun:test";
import { Task } from "../domain/task";
import type { TaskEntry } from "../types";

describe("Task", () => {
  const createTaskEntry = (overrides: Partial<TaskEntry> = {}): TaskEntry => ({
    id: "task-1",
    description: "Test task description",
    status: "pending",
    acceptanceCriteria: ["Criterion 1", "Criterion 2"],
    ...overrides,
  });

  test("complete() sets status and completedAt", () => {
    const task = new Task(createTaskEntry({ status: "in_progress" }));

    expect(task.status).toBe("in_progress");
    expect(task.completedAt).toBeUndefined();

    const beforeComplete = new Date();
    task.complete();
    const afterComplete = new Date();

    expect(task.status).toBe("completed");
    expect(task.completedAt).toBeDefined();

    const completedAtStr = task.completedAt;
    if (!completedAtStr) {
      throw new Error("completedAt should be defined");
    }

    const completedAt = new Date(completedAtStr);
    expect(completedAt.getTime()).toBeGreaterThanOrEqual(
      beforeComplete.getTime()
    );
    expect(completedAt.getTime()).toBeLessThanOrEqual(afterComplete.getTime());
  });

  test("block(reason) sets status and blockedReason", () => {
    const task = new Task(createTaskEntry({ status: "in_progress" }));

    expect(task.status).toBe("in_progress");
    expect(task.blockedReason).toBeUndefined();

    task.block("Missing dependency");

    expect(task.status).toBe("blocked");
    expect(task.blockedReason).toBe("Missing dependency");
  });

  test("fail() sets status to failed", () => {
    const task = new Task(createTaskEntry({ status: "in_progress" }));

    expect(task.status).toBe("in_progress");

    task.fail();

    expect(task.status).toBe("failed");
  });

  test("retry() increments retryCount and resets to pending", () => {
    const task = new Task(
      createTaskEntry({
        status: "blocked",
        blockedReason: "Previous blocker",
        retryCount: 2,
      })
    );

    expect(task.status).toBe("blocked");
    expect(task.retryCount).toBe(2);
    expect(task.blockedReason).toBe("Previous blocker");

    task.retry();

    expect(task.status).toBe("pending");
    expect(task.retryCount).toBe(3);
    expect(task.blockedReason).toBeUndefined();
  });

  test("toJSON() returns plain object", () => {
    const entry = createTaskEntry({
      status: "blocked",
      blockedReason: "Some reason",
      retryCount: 1,
      completedAt: "2026-01-18T10:00:00.000Z",
    });
    const task = new Task(entry);

    const json = task.toJSON();

    expect(json).toEqual({
      id: "task-1",
      description: "Test task description",
      status: "blocked",
      acceptanceCriteria: ["Criterion 1", "Criterion 2"],
      blockedReason: "Some reason",
      retryCount: 1,
      completedAt: "2026-01-18T10:00:00.000Z",
    });

    // Verify it's a plain object, not a class instance
    expect(json.constructor).toBe(Object);
    expect(json).not.toBeInstanceOf(Task);
  });
});
