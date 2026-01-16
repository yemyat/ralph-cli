import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createTestRenderer } from "@opentui/core/testing";
import { createRoot } from "@opentui/react";
import fse from "fs-extra";
import { App } from "../tui/app";

// Regex for scroll position indicator format [x-y/z]
const SCROLL_POSITION_REGEX = /\[\d+-\d+\/\d+\]/;

// Test directory for mocked project
const TEST_DIR = join(import.meta.dir, ".test-tui");

async function setupTestProject(): Promise<void> {
  await fse.ensureDir(join(TEST_DIR, ".ralph-wiggum/specs"));
  await fse.ensureDir(join(TEST_DIR, ".ralph-wiggum/logs"));

  // Create config
  await fse.writeJSON(join(TEST_DIR, ".ralph-wiggum/config.json"), {
    projectName: "test-project",
    projectPath: TEST_DIR,
    agents: {
      plan: { agent: "claude" },
      build: { agent: "claude" },
    },
    sessions: [],
  });

  // Create implementation plan
  await fse.writeFile(
    join(TEST_DIR, ".ralph-wiggum/IMPLEMENTATION_PLAN.md"),
    `# Implementation Plan

## In Progress
- specs/in-progress-spec.md

## Backlog
- specs/backlog-spec.md

## Completed
- specs/completed-spec.md
`
  );

  // Create spec files
  await fse.writeFile(
    join(TEST_DIR, ".ralph-wiggum/specs/in-progress-spec.md"),
    "# In Progress Spec\nThis is an in-progress spec."
  );
  await fse.writeFile(
    join(TEST_DIR, ".ralph-wiggum/specs/backlog-spec.md"),
    "# Backlog Spec\nThis is a backlog spec."
  );
  await fse.writeFile(
    join(TEST_DIR, ".ralph-wiggum/specs/completed-spec.md"),
    "# Completed Spec\nThis is a completed spec."
  );
}

async function cleanupTestProject(): Promise<void> {
  await fse.remove(TEST_DIR);
}

// Helper to wait for render with idle
async function waitForRender(
  renderer: { idle: () => Promise<void> },
  ms = 50
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await renderer.idle();
}

describe("TUI Headless Tests", () => {
  beforeEach(async () => {
    await cleanupTestProject();
    await setupTestProject();
  });

  afterEach(async () => {
    await cleanupTestProject();
  });

  test("Initial frame contains column headers (BACKLOG, IN PROGRESS, COMPLETED)", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer(
      {
        width: 120,
        height: 30,
      }
    );

    createRoot(renderer).render(<App projectPath={TEST_DIR} />);

    // Wait for initial render and data loading
    await waitForRender(renderer, 150);
    await renderOnce();

    const frame = captureCharFrame();

    expect(frame).toContain("BACKLOG");
    expect(frame).toContain("IN PROGRESS");
    expect(frame).toContain("COMPLETED");
    expect(frame).toContain("Ralph Wiggum CLI");

    renderer.destroy();
  });

  test("Frame shows tasks from implementation plan", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer(
      {
        width: 120,
        height: 30,
      }
    );

    createRoot(renderer).render(<App projectPath={TEST_DIR} />);

    await waitForRender(renderer, 150);
    await renderOnce();

    const frame = captureCharFrame();

    // Should display tasks from implementation plan
    expect(frame).toContain("Backlog Spec");
    expect(frame).toContain("In Progress Spec");
    expect(frame).toContain("Completed Spec");

    renderer.destroy();
  });

  test("Frame shows correct task count in footer", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer(
      {
        width: 120,
        height: 30,
      }
    );

    createRoot(renderer).render(<App projectPath={TEST_DIR} />);

    await waitForRender(renderer, 150);
    await renderOnce();

    const frame = captureCharFrame();

    // Footer shows spec count
    expect(frame).toContain("3 spec(s)");
    expect(frame).toContain("1 completed");

    renderer.destroy();
  });

  test("Enter opens detail view for any task", async () => {
    const { renderer, renderOnce, captureCharFrame, mockInput } =
      await createTestRenderer({
        width: 120,
        height: 30,
      });

    createRoot(renderer).render(<App projectPath={TEST_DIR} />);

    await waitForRender(renderer, 150);
    await renderOnce();

    // Initial frame should have kanban columns
    const kanbanFrame = captureCharFrame();
    expect(kanbanFrame).toContain("BACKLOG");

    // Open detail view for current selection
    mockInput.pressEnter();
    await waitForRender(renderer, 100);
    await renderOnce();

    const detailFrame = captureCharFrame();

    // Detail view should show spec content (📄 Spec header)
    // and should not show the kanban column headers
    expect(detailFrame).toContain("📄 Spec");
    expect(detailFrame).not.toContain("BACKLOG");
    expect(detailFrame).not.toContain("IN PROGRESS");
    expect(detailFrame).not.toContain("COMPLETED");

    renderer.destroy();
  });

  test("Kanban view shows correct status indicators", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer(
      {
        width: 120,
        height: 30,
      }
    );

    createRoot(renderer).render(<App projectPath={TEST_DIR} />);

    await waitForRender(renderer, 150);
    await renderOnce();

    const frame = captureCharFrame();

    // Status indicators
    expect(frame).toContain("○"); // Backlog indicator
    expect(frame).toContain("●"); // In progress indicator
    expect(frame).toContain("✓"); // Completed indicator

    renderer.destroy();
  });

  test("Search mode activates with / key and shows search prompt", async () => {
    const { renderer, renderOnce, captureCharFrame, mockInput } =
      await createTestRenderer({
        width: 120,
        height: 30,
      });

    createRoot(renderer).render(<App projectPath={TEST_DIR} />);

    await waitForRender(renderer, 150);
    await renderOnce();

    // Press '/' to enter search mode
    mockInput.pressKey("/");
    await waitForRender(renderer, 50);
    await renderOnce();

    const frame = captureCharFrame();

    // Search mode shows / prompt character
    expect(frame).toContain("/");

    renderer.destroy();
  });

  test("Status bar shows navigation hints", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer(
      {
        width: 120,
        height: 30,
      }
    );

    createRoot(renderer).render(<App projectPath={TEST_DIR} />);

    await waitForRender(renderer, 150);
    await renderOnce();

    const frame = captureCharFrame();

    // Status bar contains navigation hints
    expect(frame).toContain("[hjkl]");
    expect(frame).toContain("[:q]");

    renderer.destroy();
  });

  test("Spec view shows scroll position indicator", async () => {
    const { renderer, renderOnce, captureCharFrame, mockInput } =
      await createTestRenderer({
        width: 120,
        height: 30,
      });

    createRoot(renderer).render(<App projectPath={TEST_DIR} />);

    await waitForRender(renderer, 150);
    await renderOnce();

    // Navigate to IN PROGRESS and open
    mockInput.pressKey("l");
    await waitForRender(renderer, 50);
    mockInput.pressEnter();
    await waitForRender(renderer, 100);
    await renderOnce();

    const frame = captureCharFrame();

    // Detail view should show scroll position in format [x-y/z]
    expect(frame).toMatch(SCROLL_POSITION_REGEX);

    renderer.destroy();
  });
});
