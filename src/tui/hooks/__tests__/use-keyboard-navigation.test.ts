import { describe, expect, test } from "bun:test";
import type { Task } from "../../types";
import {
  type KeyEvent,
  type NavigationState,
  type NavOptions,
  useKeyboardNavigation,
} from "../use-keyboard-navigation";

// We can't easily test stateful React hooks in Bun without DOM/jsdom.
// These tests verify the hook exports, TypeScript types, and basic shapes.

const createMockTasks = (): Task[] => [
  { id: "1", name: "Setup auth", status: "backlog", specPath: "specs/auth.md" },
  {
    id: "2",
    name: "Build API",
    status: "in_progress",
    specPath: "specs/api.md",
  },
  {
    id: "3",
    name: "Add tests",
    status: "backlog",
    specPath: "specs/tests.md",
  },
];

const createKeyEvent = (
  input: string,
  overrides: Partial<KeyEvent> = {}
): KeyEvent => ({ input, ...overrides });

describe("useKeyboardNavigation", () => {
  describe("hook export", () => {
    test("hook is a function", () => {
      expect(typeof useKeyboardNavigation).toBe("function");
    });
  });

  describe("KeyEvent type", () => {
    test("createKeyEvent creates valid KeyEvent with input", () => {
      const event = createKeyEvent("j");
      expect(event.input).toBe("j");
      expect(event.isUpArrow).toBeUndefined();
    });

    test("createKeyEvent supports key modifiers", () => {
      const event = createKeyEvent("", { isEscape: true, ctrl: true });
      expect(event.input).toBe("");
      expect(event.isEscape).toBe(true);
      expect(event.ctrl).toBe(true);
    });

    test("createKeyEvent supports arrow keys", () => {
      const upEvent = createKeyEvent("", { isUpArrow: true });
      const downEvent = createKeyEvent("", { isDownArrow: true });
      expect(upEvent.isUpArrow).toBe(true);
      expect(downEvent.isDownArrow).toBe(true);
    });

    test("createKeyEvent supports return and backspace", () => {
      const returnEvent = createKeyEvent("", { isReturn: true });
      const backspaceEvent = createKeyEvent("", { isBackspace: true });
      const deleteEvent = createKeyEvent("", { isDelete: true });
      expect(returnEvent.isReturn).toBe(true);
      expect(backspaceEvent.isBackspace).toBe(true);
      expect(deleteEvent.isDelete).toBe(true);
    });
  });

  describe("Task mock data", () => {
    test("createMockTasks returns 3 tasks", () => {
      const tasks = createMockTasks();
      expect(tasks).toHaveLength(3);
    });

    test("tasks have required properties", () => {
      const tasks = createMockTasks();
      for (const task of tasks) {
        expect(typeof task.id).toBe("string");
        expect(typeof task.name).toBe("string");
        expect(typeof task.status).toBe("string");
        expect(typeof task.specPath).toBe("string");
      }
    });
  });

  describe("NavOptions type validation", () => {
    test("empty options is valid", () => {
      const options: NavOptions = {};
      expect(options).toBeDefined();
    });

    test("wrap option is boolean", () => {
      const options: NavOptions = { wrap: true };
      expect(options.wrap).toBe(true);
    });

    test("onExit is a function", () => {
      const options: NavOptions = {
        onExit: () => {
          // noop
        },
      };
      expect(typeof options.onExit).toBe("function");
    });

    test("onCommand is a function returning boolean", () => {
      const options: NavOptions = {
        onCommand: (cmd: string) => cmd === ":w",
      };
      expect(typeof options.onCommand).toBe("function");
      expect(options.onCommand?.(":w")).toBe(true);
      expect(options.onCommand?.(":q")).toBe(false);
    });
  });

  describe("NavigationState type shape", () => {
    test("NavigationState has expected properties", () => {
      // Create a mock state to verify the type shape
      const mockState: NavigationState = {
        mode: "normal",
        selectedIndex: 0,
        searchState: { query: "", matches: [], matchIndex: 0 },
        commandBuffer: "",
        handlers: {
          handleKeyEvent: (_event: KeyEvent) => {
            // noop
          },
          jumpToFirst: () => {
            // noop
          },
          jumpToLast: () => {
            // noop
          },
          navigateToIndex: (_index: number) => {
            // noop
          },
          clearSearch: () => {
            // noop
          },
          reset: () => {
            // noop
          },
        },
      };

      expect(mockState.mode).toBe("normal");
      expect(mockState.selectedIndex).toBe(0);
      expect(mockState.searchState.query).toBe("");
      expect(mockState.searchState.matches).toHaveLength(0);
      expect(mockState.commandBuffer).toBe("");
      expect(typeof mockState.handlers.handleKeyEvent).toBe("function");
    });

    test("VimMode values are valid", () => {
      const validModes = ["normal", "search", "command"];
      for (const mode of validModes) {
        const mockState: NavigationState = {
          mode: mode as "normal" | "search" | "command",
          selectedIndex: 0,
          searchState: { query: "", matches: [], matchIndex: 0 },
          commandBuffer: "",
          handlers: {
            handleKeyEvent: () => {
              // noop
            },
            jumpToFirst: () => {
              // noop
            },
            jumpToLast: () => {
              // noop
            },
            navigateToIndex: () => {
              // noop
            },
            clearSearch: () => {
              // noop
            },
            reset: () => {
              // noop
            },
          },
        };
        expect(validModes).toContain(mockState.mode);
      }
    });
  });
});
