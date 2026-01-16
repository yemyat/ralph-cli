import { describe, expect, test } from "bun:test";
import type { RalphSession } from "../../../types";
import {
  type SessionPollingOptions,
  type SessionPollingState,
  useSessionPolling,
} from "../use-session-polling";

// We can't easily test stateful React hooks in Bun without DOM/jsdom.
// These tests verify the hook exports, TypeScript types, and basic shapes.

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

describe("useSessionPolling", () => {
  describe("hook export", () => {
    test("hook is a function", () => {
      expect(typeof useSessionPolling).toBe("function");
    });
  });

  describe("RalphSession type", () => {
    test("createMockSession creates valid session with defaults", () => {
      const session = createMockSession();
      expect(session.id).toBe("session-1");
      expect(session.mode).toBe("build");
      expect(session.status).toBe("running");
      expect(session.pid).toBe(12_345);
    });

    test("createMockSession supports overrides", () => {
      const session = createMockSession({
        status: "stopped",
        stoppedAt: "2026-01-16T13:00:00Z",
      });
      expect(session.status).toBe("stopped");
      expect(session.stoppedAt).toBe("2026-01-16T13:00:00Z");
    });

    test("session has required properties", () => {
      const session = createMockSession();
      expect(typeof session.id).toBe("string");
      expect(typeof session.mode).toBe("string");
      expect(typeof session.status).toBe("string");
      expect(typeof session.iteration).toBe("number");
      expect(typeof session.startedAt).toBe("string");
      expect(typeof session.agent).toBe("string");
    });

    test("session pid is optional", () => {
      const session = createMockSession({ pid: undefined });
      expect(session.pid).toBeUndefined();
    });
  });

  describe("SessionPollingOptions type validation", () => {
    test("empty options is valid", () => {
      const options: SessionPollingOptions = {};
      expect(options).toBeDefined();
    });

    test("getSessions option is a function", () => {
      const mockGetSessions = async () => [];
      const options: SessionPollingOptions = { getSessions: mockGetSessions };
      expect(typeof options.getSessions).toBe("function");
    });

    test("pollIntervalMs option is a number", () => {
      const options: SessionPollingOptions = { pollIntervalMs: 5000 };
      expect(options.pollIntervalMs).toBe(5000);
    });

    test("options support both values together", () => {
      const options: SessionPollingOptions = {
        getSessions: async () => [createMockSession()],
        pollIntervalMs: 1000,
      };
      expect(typeof options.getSessions).toBe("function");
      expect(options.pollIntervalMs).toBe(1000);
    });
  });

  describe("SessionPollingState type shape", () => {
    test("SessionPollingState has expected properties", () => {
      // Create a mock state to verify the type shape
      const mockState: SessionPollingState = {
        runningSession: null,
        isPolling: false,
        reloadSession: async () => {
          // noop
        },
        setRunningSession: () => {
          // noop
        },
      };

      expect(mockState.runningSession).toBeNull();
      expect(mockState.isPolling).toBe(false);
      expect(typeof mockState.reloadSession).toBe("function");
      expect(typeof mockState.setRunningSession).toBe("function");
    });

    test("SessionPollingState runningSession can be a session", () => {
      const mockState: SessionPollingState = {
        runningSession: createMockSession(),
        isPolling: true,
        reloadSession: async () => {
          // noop
        },
        setRunningSession: () => {
          // noop
        },
      };

      expect(mockState.runningSession).not.toBeNull();
      expect(mockState.runningSession?.pid).toBe(12_345);
      expect(mockState.isPolling).toBe(true);
    });
  });

  describe("getSessions mock function", () => {
    test("mock returns empty array", async () => {
      const mockGetSessions = async (): Promise<RalphSession[]> => [];
      const result = await mockGetSessions();
      expect(result).toEqual([]);
    });

    test("mock returns sessions array", async () => {
      const sessions = [
        createMockSession({ id: "s1", status: "running" }),
        createMockSession({ id: "s2", status: "completed" }),
      ];
      const mockGetSessions = async (): Promise<RalphSession[]> => sessions;
      const result = await mockGetSessions();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("s1");
    });

    test("find running session from array", async () => {
      const sessions = [
        createMockSession({ id: "s1", status: "completed" }),
        createMockSession({ id: "s2", status: "running" }),
        createMockSession({ id: "s3", status: "stopped" }),
      ];
      const running = sessions.find((s) => s.status === "running");
      expect(running?.id).toBe("s2");
    });
  });
});
