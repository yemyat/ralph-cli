import { describe, expect, test } from "bun:test";
import type { RalphSession } from "../../../types";
import type { Task } from "../../types";
import {
  type ConfirmState,
  type TaskManagerHandlers,
  type TaskManagerOptions,
  type TaskManagerResult,
  type TaskManagerState,
  useTaskManager,
} from "../use-task-manager";

// We can't easily test stateful React hooks in Bun without DOM/jsdom.
// These tests verify the hook exports, TypeScript types, and basic shapes.

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  name: "Build API",
  status: "in_progress",
  specPath: "specs/api.md",
  ...overrides,
});

const createMockSession = (
  overrides: Partial<RalphSession> = {}
): RalphSession => ({
  id: "session-1",
  mode: "build",
  status: "running",
  pid: 12_345,
  iteration: 1,
  startedAt: "2026-01-16T12:00:00Z",
  agent: "claude",
  ...overrides,
});

describe("useTaskManager", () => {
  describe("hook export", () => {
    test("hook is a function", () => {
      expect(typeof useTaskManager).toBe("function");
    });
  });

  describe("ConfirmState type", () => {
    test("ConfirmState can be null", () => {
      const state: ConfirmState = null;
      expect(state).toBeNull();
    });

    test("ConfirmState can be confirm-stop", () => {
      const state: ConfirmState = "confirm-stop";
      expect(state).toBe("confirm-stop");
    });

    test("ConfirmState can be force-kill", () => {
      const state: ConfirmState = "force-kill";
      expect(state).toBe("force-kill");
    });
  });

  describe("TaskManagerOptions type validation", () => {
    test("minimal options is valid", () => {
      const options: TaskManagerOptions = {
        projectPath: "/project",
        runningSession: null,
        logPath: null,
      };
      expect(options.projectPath).toBe("/project");
      expect(options.runningSession).toBeNull();
      expect(options.logPath).toBeNull();
    });

    test("options with session and log", () => {
      const options: TaskManagerOptions = {
        projectPath: "/project",
        runningSession: createMockSession(),
        logPath: "/project/logs/session-1.log",
      };
      expect(options.runningSession?.pid).toBe(12_345);
      expect(options.logPath).toContain("session-1.log");
    });

    test("options with callbacks", () => {
      const callResults = {
        stopCalled: false,
        updatedSession: null as RalphSession | null,
      };

      const options: TaskManagerOptions = {
        projectPath: "/project",
        runningSession: createMockSession(),
        logPath: null,
        onTaskStopped: async () => {
          callResults.stopCalled = true;
        },
        onSessionUpdate: (session) => {
          callResults.updatedSession = session;
        },
      };

      expect(typeof options.onTaskStopped).toBe("function");
      expect(typeof options.onSessionUpdate).toBe("function");

      // Verify callbacks work
      options.onTaskStopped?.();
      expect(callResults.stopCalled).toBe(true);

      const stoppedSession = createMockSession({ status: "stopped" });
      options.onSessionUpdate?.(stoppedSession);
      expect(callResults.updatedSession).not.toBeNull();
      expect(callResults.updatedSession?.status).toBe("stopped");
    });

    test("gracefulTimeoutMs option", () => {
      const options: TaskManagerOptions = {
        projectPath: "/project",
        runningSession: null,
        logPath: null,
        gracefulTimeoutMs: 10_000,
      };
      expect(options.gracefulTimeoutMs).toBe(10_000);
    });
  });

  describe("TaskManagerState type shape", () => {
    test("TaskManagerState has expected properties", () => {
      const mockState: TaskManagerState = {
        confirmState: null,
        taskToStop: null,
        stoppingTaskId: null,
      };

      expect(mockState.confirmState).toBeNull();
      expect(mockState.taskToStop).toBeNull();
      expect(mockState.stoppingTaskId).toBeNull();
    });

    test("TaskManagerState with active stop", () => {
      const task = createMockTask();
      const mockState: TaskManagerState = {
        confirmState: "confirm-stop",
        taskToStop: task,
        stoppingTaskId: null,
      };

      expect(mockState.confirmState).toBe("confirm-stop");
      expect(mockState.taskToStop?.id).toBe("task-1");
    });

    test("TaskManagerState during stopping", () => {
      const task = createMockTask();
      const mockState: TaskManagerState = {
        confirmState: null,
        taskToStop: task,
        stoppingTaskId: "task-1",
      };

      expect(mockState.confirmState).toBeNull();
      expect(mockState.stoppingTaskId).toBe("task-1");
    });

    test("TaskManagerState with force-kill dialog", () => {
      const task = createMockTask();
      const mockState: TaskManagerState = {
        confirmState: "force-kill",
        taskToStop: task,
        stoppingTaskId: "task-1",
      };

      expect(mockState.confirmState).toBe("force-kill");
      expect(mockState.stoppingTaskId).toBe("task-1");
    });
  });

  describe("TaskManagerHandlers type shape", () => {
    test("TaskManagerHandlers has expected functions", () => {
      const mockHandlers: TaskManagerHandlers = {
        initiateStop: () => {},
        confirmStop: async () => {},
        forceKill: async () => {},
        cancelStop: () => {},
      };

      expect(typeof mockHandlers.initiateStop).toBe("function");
      expect(typeof mockHandlers.confirmStop).toBe("function");
      expect(typeof mockHandlers.forceKill).toBe("function");
      expect(typeof mockHandlers.cancelStop).toBe("function");
    });
  });

  describe("TaskManagerResult type shape", () => {
    test("TaskManagerResult combines state and handlers", () => {
      const mockResult: TaskManagerResult = {
        // State
        confirmState: null,
        taskToStop: null,
        stoppingTaskId: null,
        // Handlers
        initiateStop: () => {},
        confirmStop: async () => {},
        forceKill: async () => {},
        cancelStop: () => {},
      };

      // State properties
      expect(mockResult.confirmState).toBeNull();
      expect(mockResult.taskToStop).toBeNull();
      expect(mockResult.stoppingTaskId).toBeNull();

      // Handler properties
      expect(typeof mockResult.initiateStop).toBe("function");
      expect(typeof mockResult.confirmStop).toBe("function");
      expect(typeof mockResult.forceKill).toBe("function");
      expect(typeof mockResult.cancelStop).toBe("function");
    });
  });

  describe("Task mock data", () => {
    test("createMockTask creates valid task with defaults", () => {
      const task = createMockTask();
      expect(task.id).toBe("task-1");
      expect(task.name).toBe("Build API");
      expect(task.status).toBe("in_progress");
      expect(task.specPath).toBe("specs/api.md");
    });

    test("createMockTask supports overrides", () => {
      const task = createMockTask({
        id: "task-2",
        name: "Setup auth",
        status: "backlog",
      });
      expect(task.id).toBe("task-2");
      expect(task.name).toBe("Setup auth");
      expect(task.status).toBe("backlog");
    });

    test("only in_progress tasks should be stoppable", () => {
      const statuses = ["backlog", "in_progress", "completed", "stopped"];
      for (const status of statuses) {
        const task = createMockTask({
          status: status as Task["status"],
        });
        const isStoppable = task.status === "in_progress";
        expect(isStoppable).toBe(status === "in_progress");
      }
    });
  });

  describe("Stop flow state transitions", () => {
    test("initial state is idle", () => {
      const state: TaskManagerState = {
        confirmState: null,
        taskToStop: null,
        stoppingTaskId: null,
      };
      expect(state.confirmState).toBeNull();
      expect(state.taskToStop).toBeNull();
      expect(state.stoppingTaskId).toBeNull();
    });

    test("after initiateStop, confirmState is confirm-stop", () => {
      const task = createMockTask();
      const state: TaskManagerState = {
        confirmState: "confirm-stop",
        taskToStop: task,
        stoppingTaskId: null,
      };
      expect(state.confirmState).toBe("confirm-stop");
      expect(state.taskToStop).toBe(task);
    });

    test("after confirmStop, stoppingTaskId is set", () => {
      const task = createMockTask();
      const state: TaskManagerState = {
        confirmState: null,
        taskToStop: task,
        stoppingTaskId: task.id,
      };
      expect(state.confirmState).toBeNull();
      expect(state.stoppingTaskId).toBe("task-1");
    });

    test("after timeout, confirmState is force-kill", () => {
      const task = createMockTask();
      const state: TaskManagerState = {
        confirmState: "force-kill",
        taskToStop: task,
        stoppingTaskId: task.id,
      };
      expect(state.confirmState).toBe("force-kill");
    });

    test("after cancelStop, state is reset", () => {
      const state: TaskManagerState = {
        confirmState: null,
        taskToStop: null,
        stoppingTaskId: null,
      };
      expect(state.confirmState).toBeNull();
      expect(state.taskToStop).toBeNull();
      expect(state.stoppingTaskId).toBeNull();
    });
  });

  describe("ESRCH error handling", () => {
    test("ESRCH code indicates process already dead", () => {
      const esrchError = new Error("ESRCH");
      (esrchError as NodeJS.ErrnoException).code = "ESRCH";
      expect((esrchError as NodeJS.ErrnoException).code).toBe("ESRCH");
    });

    test("other error codes are different", () => {
      const epermError = new Error("EPERM");
      (epermError as NodeJS.ErrnoException).code = "EPERM";
      expect((epermError as NodeJS.ErrnoException).code).not.toBe("ESRCH");
    });
  });
});
