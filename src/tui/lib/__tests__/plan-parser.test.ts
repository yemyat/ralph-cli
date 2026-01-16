import { describe, expect, test } from "bun:test";
import {
  detectSection,
  extractSpecName,
  parseImplementationPlanContent,
} from "../plan-parser";

describe("parseImplementationPlanContent", () => {
  test("parses tasks from all sections", () => {
    const content = `# Implementation Plan

## In Progress
- specs/tui.md

## Backlog
- specs/auth.md
- [stopped] specs/api.md

## Completed
- [x] specs/setup.md
`;

    const result = parseImplementationPlanContent(content);

    expect(result.inProgress).toHaveLength(1);
    expect(result.backlog).toHaveLength(1);
    expect(result.stopped).toHaveLength(1);
    expect(result.completed).toHaveLength(1);

    expect(result.inProgress[0]).toMatchObject({
      name: "Tui",
      status: "in_progress",
      specPath: "specs/tui.md",
    });
    expect(result.backlog[0]).toMatchObject({
      name: "Auth",
      status: "backlog",
      specPath: "specs/auth.md",
    });
    expect(result.stopped[0]).toMatchObject({
      name: "Api",
      status: "stopped",
      specPath: "specs/api.md",
    });
    expect(result.completed[0]).toMatchObject({
      name: "Setup",
      status: "completed",
      specPath: "specs/setup.md",
    });
  });

  test("handles empty sections", () => {
    const content = `# Implementation Plan

## In Progress

## Backlog

## Completed
`;

    const result = parseImplementationPlanContent(content);
    expect(result.inProgress).toHaveLength(0);
    expect(result.backlog).toHaveLength(0);
    expect(result.completed).toHaveLength(0);
    expect(result.stopped).toHaveLength(0);
  });

  test("handles missing sections", () => {
    const content = `# Implementation Plan

## Backlog
- specs/task1.md
`;

    const result = parseImplementationPlanContent(content);
    expect(result.inProgress).toHaveLength(0);
    expect(result.backlog).toHaveLength(1);
    expect(result.completed).toHaveLength(0);
  });

  test("ignores HTML comments", () => {
    const content = `# Implementation Plan

## In Progress
<!-- This is a comment -->
- specs/feature.md

## Backlog
<!-- Another comment -->
`;

    const result = parseImplementationPlanContent(content);
    expect(result.inProgress).toHaveLength(1);
    expect(result.backlog).toHaveLength(0);
  });

  test("handles numbered spec paths", () => {
    const content = `## Backlog
- specs/001-first-spec.md
- specs/002-second-spec.md
`;

    const result = parseImplementationPlanContent(content);
    expect(result.backlog).toHaveLength(2);
    expect(result.backlog[0].name).toBe("First Spec");
    expect(result.backlog[1].name).toBe("Second Spec");
  });
});

describe("extractSpecName", () => {
  test("converts kebab-case to title case", () => {
    expect(extractSpecName("specs/my-feature.md")).toBe("My Feature");
  });

  test("removes leading numbers", () => {
    expect(extractSpecName("specs/001-first-feature.md")).toBe("First Feature");
    expect(extractSpecName("specs/99-another.md")).toBe("Another");
  });

  test("handles single word", () => {
    expect(extractSpecName("specs/auth.md")).toBe("Auth");
  });
});

describe("detectSection", () => {
  test("detects In Progress section", () => {
    expect(detectSection("## In Progress")).toBe("in_progress");
  });

  test("detects Backlog section", () => {
    expect(detectSection("## Backlog")).toBe("backlog");
  });

  test("detects Completed section", () => {
    expect(detectSection("## Completed")).toBe("completed");
  });

  test("returns null for non-section lines", () => {
    expect(detectSection("- specs/task.md")).toBeNull();
    expect(detectSection("## Other Section")).toBeNull();
    expect(detectSection("some text")).toBeNull();
  });
});
