import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createTestRenderer } from "@opentui/core/testing";
import { createRoot } from "@opentui/react";
import fse from "fs-extra";
import { App } from "../tui/app";

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

  // Create implementation.json
  await fse.writeJSON(join(TEST_DIR, ".ralph-wiggum/implementation.json"), {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "user",
    specs: [
      {
        id: "in-progress-spec",
        file: "specs/in-progress-spec.md",
        name: "In Progress Spec",
        priority: 1,
        status: "in_progress",
        tasks: [],
        acceptanceCriteria: [],
      },
      {
        id: "backlog-spec",
        file: "specs/backlog-spec.md",
        name: "Backlog Spec",
        priority: 2,
        status: "pending",
        tasks: [],
        acceptanceCriteria: [],
      },
      {
        id: "completed-spec",
        file: "specs/completed-spec.md",
        name: "Completed Spec",
        priority: 3,
        status: "completed",
        tasks: [],
        acceptanceCriteria: [],
      },
    ],
  });

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

  test("Initial frame contains sidebar section headers", async () => {
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

    // New sidebar layout has section headers in uppercase
    expect(frame).toContain("BACKLOG");
    expect(frame).toContain("IN PROGRESS");
    expect(frame).toContain("COMPLETED");

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
    // Note: In sidebar layout, completed tasks are collapsed by default
    // so we check for the visible ones
    expect(frame).toContain("In Progress Spec");

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

  test("Detail panel shows spec content for selected task", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer(
      {
        width: 120,
        height: 30,
      }
    );

    createRoot(renderer).render(<App projectPath={TEST_DIR} />);

    await waitForRender(renderer, 150);
    await renderOnce();

    // In sidebar layout, detail panel shows on the right by default
    // when a task is selected
    const frame = captureCharFrame();

    // Sidebar should show section headers
    expect(frame).toContain("IN PROGRESS");

    // Detail panel should show the selected task's spec content
    expect(frame).toContain("In Progress Spec");

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

    // Status bar contains navigation hints (sidebar uses jk for vertical nav only)
    expect(frame).toContain("[jk]");
    expect(frame).toContain("[:q]");

    renderer.destroy();
  });

  test("Status bar shows task count", async () => {
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

    // Footer should show task count info
    expect(frame).toContain("3 spec(s)");

    renderer.destroy();
  });
});
