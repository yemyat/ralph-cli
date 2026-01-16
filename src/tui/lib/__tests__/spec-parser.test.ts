import { describe, expect, test } from "bun:test";
import { parseSpecContent } from "../spec-parser";

describe("parseSpecContent", () => {
  test("extracts all sections", () => {
    const content = `# Feature

## Overview
This feature does X.

## Tasks
- [ ] Task 1
- [x] Task 2

## Acceptance Criteria
- [ ] AC 1
- [ ] AC 2
`;

    const result = parseSpecContent(content);

    expect(result.overview).toContain("This feature does X");
    expect(result.tasks).toEqual(["Task 1", "Task 2"]);
    expect(result.acceptanceCriteria).toEqual(["AC 1", "AC 2"]);
  });

  test("preserves raw content", () => {
    const content = "# Just a title";
    const result = parseSpecContent(content);
    expect(result.raw).toBe(content);
  });

  test("handles missing sections gracefully", () => {
    const content = `# Minimal Spec

## Overview
Just an overview, no tasks.
`;

    const result = parseSpecContent(content);
    expect(result.overview).toContain("Just an overview");
    expect(result.tasks).toEqual([]);
    expect(result.acceptanceCriteria).toEqual([]);
  });

  test("handles empty spec", () => {
    const content = "";
    const result = parseSpecContent(content);
    expect(result.overview).toBe("");
    expect(result.tasks).toEqual([]);
    expect(result.acceptanceCriteria).toEqual([]);
    expect(result.raw).toBe("");
  });

  test("stops section at next ## header", () => {
    const content = `## Overview
The overview text.

## Implementation Details
This is NOT part of overview.

## Tasks
- [ ] A task
`;

    const result = parseSpecContent(content);
    expect(result.overview).toContain("The overview text");
    expect(result.overview).not.toContain("Implementation Details");
    expect(result.tasks).toEqual(["A task"]);
  });

  test("handles nested checkbox lists", () => {
    const content = `## Tasks
- [ ] Parent task
  - [ ] Child task (not parsed as top-level)
- [x] Another parent
`;

    const result = parseSpecContent(content);
    // Only top-level checkboxes (starting with - at column 0) are parsed
    expect(result.tasks).toEqual(["Parent task", "Another parent"]);
  });

  test("handles multiline overview", () => {
    const content = `## Overview
First paragraph.

Second paragraph with more details.
And a third line.

## Tasks
- [ ] Do something
`;

    const result = parseSpecContent(content);
    expect(result.overview).toContain("First paragraph");
    expect(result.overview).toContain("Second paragraph");
    expect(result.overview).toContain("third line");
  });
});
