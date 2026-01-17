import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Implementation, QualityGateResult, TaskEntry } from "../types";
import {
  getNextPendingTask,
  markTaskBlocked,
  markTaskCompleted,
  markTaskInProgress,
  saveImplementation,
} from "../utils/implementation";
import { generateRetryPrompt, generateTaskPrompt } from "../utils/task-prompts";

// Path to mock agent script
const MOCK_AGENT_PATH = resolve(
  dirname(import.meta.path),
  "fixtures/mock-task-agent.ts"
);

// Regex patterns for extracting prompt sections (defined at top level for performance)
const TASK_ASSIGNMENT_REGEX =
  /## Your Assignment\s+Complete ONLY this task:\s+>\s*([^\n]+)/;
const COMPLETED_TASKS_SECTION_REGEX =
  /## Completed Tasks\n\n([\s\S]*?)(?=\n##|$)/;
const ASSIGNMENT_SECTION_REGEX =
  /## Your Assignment\n\n([\s\S]*?)(?=\n## Acceptance|$)/;
const ACCEPTANCE_CRITERIA_SECTION_REGEX =
  /## Acceptance Criteria\n\n([\s\S]*?)(?=\n## Rules|$)/;

/**
 * Create a mock implementation with the specified number of tasks.
 */
function createMockImplementation(taskDescriptions: string[]): Implementation {
  const tasks: TaskEntry[] = taskDescriptions.map((desc, i) => ({
    id: `task-${i + 1}`,
    description: desc,
    status: "pending",
    acceptanceCriteria: [`AC for ${desc}`],
  }));

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "user",
    specs: [
      {
        id: "spec-1",
        file: "specs/test-spec.md",
        name: "Test Spec",
        priority: 1,
        status: "pending",
        context: "Test context for isolation verification",
        tasks,
      },
    ],
  };
}

// Regex to extract blocked reason from agent output (matches start.ts pattern)
const TASK_BLOCKED_REGEX = /<TASK_BLOCKED\s+reason="([^"]+)">/;

interface MockAgentOptions {
  response?: "done" | "blocked";
  blockedReason?: string;
}

interface MockAgentResult {
  status: "done" | "blocked" | "error";
  output: string;
  reason?: string;
}

/**
 * Execute the mock agent with a prompt and capture the result.
 */
function executeMockAgent(
  promptFile: string,
  prompt: string,
  cwd: string,
  options: MockAgentOptions = {}
): Promise<MockAgentResult> {
  return new Promise((resolve) => {
    let stdoutBuffer = "";

    const child = spawn("bun", [MOCK_AGENT_PATH], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        MOCK_PROMPT_FILE: promptFile,
        MOCK_RESPONSE: options.response || "done",
        MOCK_BLOCKED_REASON: options.blockedReason || "Unknown reason",
      },
    });

    child.stdin?.write(prompt);
    child.stdin?.end();

    child.stdout?.on("data", (data) => {
      stdoutBuffer += data.toString();
    });

    child.stderr?.on("data", () => {
      // Ignore stderr for this test
    });

    child.on("close", (code) => {
      if (stdoutBuffer.includes("<TASK_DONE>")) {
        resolve({ status: "done", output: stdoutBuffer });
      } else if (stdoutBuffer.includes("<TASK_BLOCKED")) {
        // Extract reason from blocked marker (same regex as start.ts)
        const blockedMatch = stdoutBuffer.match(TASK_BLOCKED_REGEX);
        resolve({
          status: "blocked",
          output: stdoutBuffer,
          reason: blockedMatch?.[1],
        });
      } else if (code === 0) {
        resolve({ status: "done", output: stdoutBuffer });
      } else {
        resolve({ status: "error", output: stdoutBuffer });
      }
    });

    child.on("error", () => {
      resolve({ status: "error", output: stdoutBuffer });
    });
  });
}

describe("Task-Level Build Loop Integration", () => {
  let testDir: string;
  let promptFiles: string[];

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "ralph-task-loop-"));
    promptFiles = [];

    // Create ralph directory structure
    await mkdir(join(testDir, ".ralph-wiggum"), { recursive: true });
    await mkdir(join(testDir, ".ralph-wiggum", "logs"), { recursive: true });
    await mkdir(join(testDir, ".ralph-wiggum", "specs"), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("Task Isolation", () => {
    it("spawns 3 separate sessions for 3 tasks with isolated prompts", async () => {
      // Setup: Create implementation with 3 distinct tasks
      const taskDescriptions = [
        "Implement user authentication module",
        "Create database migration scripts",
        "Add API endpoint for user profiles",
      ];

      const impl = createMockImplementation(taskDescriptions);
      await saveImplementation(testDir, impl);

      // Track spawned sessions
      const spawnedSessions: {
        taskId: string;
        promptFile: string;
        promptContent: string;
      }[] = [];

      // Simulate the task-level loop by iterating through tasks
      let iteration = 0;
      const maxIterations = 10; // Safety limit

      while (iteration < maxIterations) {
        // Re-read implementation (mimics actual loop behavior)
        const currentImpl = JSON.parse(
          await readFile(
            join(testDir, ".ralph-wiggum", "implementation.json"),
            "utf-8"
          )
        ) as Implementation;

        const next = getNextPendingTask(currentImpl);
        if (!next) {
          break;
        }

        const { spec, task } = next;
        iteration++;

        // Create unique prompt file for this task
        const promptFile = join(testDir, `prompt-task-${task.id}.md`);
        promptFiles.push(promptFile);

        // Generate the task prompt (this is what the real loop does)
        const taskPrompt = generateTaskPrompt(spec, task);

        // Mark task as in progress
        markTaskInProgress(currentImpl, spec.id, task.id);
        await saveImplementation(testDir, currentImpl);

        // Execute the mock agent (simulates spawning a session)
        const result = await executeMockAgent(promptFile, taskPrompt, testDir);

        // Record this session
        spawnedSessions.push({
          taskId: task.id,
          promptFile,
          promptContent: await readFile(promptFile, "utf-8"),
        });

        // Mark task completed (skip quality gates for this test)
        if (result.status === "done") {
          markTaskCompleted(currentImpl, spec.id, task.id);
          await saveImplementation(testDir, currentImpl);
        }
      }

      // Assertions

      // 1. Verify 3 separate sessions were spawned
      expect(spawnedSessions.length).toBe(3);

      // 2. Verify each prompt contains ONLY its corresponding task in the assignment section
      for (let i = 0; i < taskDescriptions.length; i++) {
        const session = spawnedSessions[i];
        const expectedTaskDesc = taskDescriptions[i];

        // Prompt should contain its own task description in the header
        expect(session.promptContent).toContain(`# Task: ${expectedTaskDesc}`);

        // Extract the "Your Assignment" section to verify isolation
        const assignmentMatch = session.promptContent.match(
          TASK_ASSIGNMENT_REGEX
        );
        expect(assignmentMatch).not.toBeNull();
        expect(assignmentMatch?.[1]).toBe(expectedTaskDesc);

        // Verify that FUTURE tasks are NOT mentioned in the prompt
        // (Previous completed tasks ARE expected in "Completed Tasks" section)
        for (let j = i + 1; j < taskDescriptions.length; j++) {
          // Future task should not appear anywhere in the prompt
          expect(session.promptContent).not.toContain(taskDescriptions[j]);
        }

        // Prompt should contain completion markers instruction
        expect(session.promptContent).toContain("<TASK_DONE>");
        expect(session.promptContent).toContain("<TASK_BLOCKED");
      }

      // 3. Verify prompts are distinct files
      const uniquePromptFiles = new Set(
        spawnedSessions.map((s) => s.promptFile)
      );
      expect(uniquePromptFiles.size).toBe(3);

      // 4. Verify all tasks were processed
      const finalImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;
      const completedTasks = finalImpl.specs[0].tasks.filter(
        (t) => t.status === "completed"
      );
      expect(completedTasks.length).toBe(3);
    });

    it("includes spec context in each task prompt", async () => {
      const impl = createMockImplementation(["Task A", "Task B", "Task C"]);
      impl.specs[0].context = "This is important spec context for verification";
      await saveImplementation(testDir, impl);

      const capturedPrompts: string[] = [];

      // Process all 3 tasks
      for (let i = 0; i < 3; i++) {
        const currentImpl = JSON.parse(
          await readFile(
            join(testDir, ".ralph-wiggum", "implementation.json"),
            "utf-8"
          )
        ) as Implementation;

        const next = getNextPendingTask(currentImpl);
        if (!next) {
          break;
        }

        const { spec, task } = next;
        const promptFile = join(testDir, `prompt-${i}.md`);
        const taskPrompt = generateTaskPrompt(spec, task);

        markTaskInProgress(currentImpl, spec.id, task.id);
        await saveImplementation(testDir, currentImpl);

        await executeMockAgent(promptFile, taskPrompt, testDir);
        capturedPrompts.push(await readFile(promptFile, "utf-8"));

        markTaskCompleted(currentImpl, spec.id, task.id);
        await saveImplementation(testDir, currentImpl);
      }

      // Each prompt should contain the spec context
      for (const prompt of capturedPrompts) {
        expect(prompt).toContain(
          "This is important spec context for verification"
        );
      }
    });

    it("tracks completed tasks in subsequent prompts", async () => {
      const impl = createMockImplementation([
        "First task to complete",
        "Second task after first",
        "Third task after second",
      ]);
      await saveImplementation(testDir, impl);

      const capturedPrompts: string[] = [];

      // Process all 3 tasks
      for (let i = 0; i < 3; i++) {
        const currentImpl = JSON.parse(
          await readFile(
            join(testDir, ".ralph-wiggum", "implementation.json"),
            "utf-8"
          )
        ) as Implementation;

        const next = getNextPendingTask(currentImpl);
        if (!next) {
          break;
        }

        const { spec, task } = next;
        const promptFile = join(testDir, `prompt-${i}.md`);
        const taskPrompt = generateTaskPrompt(spec, task);

        markTaskInProgress(currentImpl, spec.id, task.id);
        await saveImplementation(testDir, currentImpl);

        await executeMockAgent(promptFile, taskPrompt, testDir);
        capturedPrompts.push(await readFile(promptFile, "utf-8"));

        markTaskCompleted(currentImpl, spec.id, task.id);
        await saveImplementation(testDir, currentImpl);
      }

      // First task prompt: no completed tasks
      expect(capturedPrompts[0]).toContain("No tasks completed yet");
      expect(capturedPrompts[0]).not.toContain("[x]");

      // Second task prompt: first task should be marked completed
      expect(capturedPrompts[1]).toContain("[x] First task to complete");
      expect(capturedPrompts[1]).not.toContain("[x] Second task");

      // Third task prompt: first two tasks should be marked completed
      expect(capturedPrompts[2]).toContain("[x] First task to complete");
      expect(capturedPrompts[2]).toContain("[x] Second task after first");
      expect(capturedPrompts[2]).not.toContain("[x] Third task");
    });

    it("captured prompt contains ONLY current task, not other tasks", async () => {
      // Setup: Create implementation with 3 uniquely identifiable tasks
      const task1Description = "UNIQUE_TASK_ONE_create_user_model";
      const task2Description = "UNIQUE_TASK_TWO_implement_auth_service";
      const task3Description = "UNIQUE_TASK_THREE_add_api_routes";

      const impl = createMockImplementation([
        task1Description,
        task2Description,
        task3Description,
      ]);
      await saveImplementation(testDir, impl);

      // Complete task 1 first
      let currentImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;

      const task1Next = getNextPendingTask(currentImpl);
      expect(task1Next).not.toBeNull();
      if (!task1Next) {
        throw new Error("Expected task1Next to exist");
      }
      markTaskInProgress(currentImpl, task1Next.spec.id, task1Next.task.id);
      await saveImplementation(testDir, currentImpl);

      const prompt1File = join(testDir, "prompt-task1.md");
      const task1Prompt = generateTaskPrompt(task1Next.spec, task1Next.task);
      await executeMockAgent(prompt1File, task1Prompt, testDir);

      markTaskCompleted(currentImpl, task1Next.spec.id, task1Next.task.id);
      await saveImplementation(testDir, currentImpl);

      // Now process task 2 - this is the main test case
      currentImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;

      const task2Next = getNextPendingTask(currentImpl);
      expect(task2Next).not.toBeNull();
      if (!task2Next) {
        throw new Error("Expected task2Next to exist");
      }
      expect(task2Next.task.description).toBe(task2Description);

      markTaskInProgress(currentImpl, task2Next.spec.id, task2Next.task.id);
      await saveImplementation(testDir, currentImpl);

      const prompt2File = join(testDir, "prompt-task2.md");
      const task2Prompt = generateTaskPrompt(task2Next.spec, task2Next.task);
      await executeMockAgent(prompt2File, task2Prompt, testDir);

      const capturedPrompt = await readFile(prompt2File, "utf-8");

      // ===== ACCEPTANCE CRITERIA VERIFICATION =====

      // 1. Prompt title should contain ONLY task 2 description
      expect(capturedPrompt).toContain(`# Task: ${task2Description}`);
      expect(capturedPrompt).not.toContain(`# Task: ${task1Description}`);
      expect(capturedPrompt).not.toContain(`# Task: ${task3Description}`);

      // 2. "Your Assignment" section should contain ONLY task 2
      const assignmentMatch = capturedPrompt.match(TASK_ASSIGNMENT_REGEX);
      expect(assignmentMatch).not.toBeNull();
      expect(assignmentMatch?.[1]).toBe(task2Description);

      // 3. Task 3 should NOT appear ANYWHERE in the prompt
      expect(capturedPrompt).not.toContain(task3Description);

      // 4. Task 1 should appear ONLY in "Completed Tasks" section, not elsewhere
      // Split prompt into sections to verify task 1 location
      const completedTasksSection =
        capturedPrompt.match(COMPLETED_TASKS_SECTION_REGEX)?.[1] || "";
      const assignmentSection =
        capturedPrompt.match(ASSIGNMENT_SECTION_REGEX)?.[1] || "";

      // Task 1 should be in completed tasks section (as [x] checkbox)
      expect(completedTasksSection).toContain(task1Description);
      expect(completedTasksSection).toContain("[x]");

      // Task 1 should NOT be in the assignment section
      expect(assignmentSection).not.toContain(task1Description);

      // 5. Acceptance criteria should be for task 2 ONLY
      const acceptanceCriteriaSection =
        capturedPrompt.match(ACCEPTANCE_CRITERIA_SECTION_REGEX)?.[1] || "";
      expect(acceptanceCriteriaSection).toContain(`AC for ${task2Description}`);
      expect(acceptanceCriteriaSection).not.toContain(
        `AC for ${task1Description}`
      );
      expect(acceptanceCriteriaSection).not.toContain(
        `AC for ${task3Description}`
      );
    });
  });

  describe("Task Status Updates", () => {
    it("implementation.json task status updates to completed after success", async () => {
      // Setup: Create implementation with 3 tasks
      const taskDescriptions = [
        "Implement user authentication",
        "Add database models",
        "Create API endpoints",
      ];

      const impl = createMockImplementation(taskDescriptions);
      await saveImplementation(testDir, impl);

      // Verify initial state: all tasks are pending
      const initialImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;
      expect(
        initialImpl.specs[0].tasks.every((t) => t.status === "pending")
      ).toBe(true);

      // Process all 3 tasks successfully (simulating the build loop)
      for (let i = 0; i < 3; i++) {
        // Re-read implementation (mimics actual loop behavior)
        const currentImpl = JSON.parse(
          await readFile(
            join(testDir, ".ralph-wiggum", "implementation.json"),
            "utf-8"
          )
        ) as Implementation;

        const next = getNextPendingTask(currentImpl);
        expect(next).not.toBeNull();
        if (!next) {
          throw new Error(`Expected task ${i + 1} to exist`);
        }

        const { spec, task } = next;

        // Verify task is the expected one
        expect(task.description).toBe(taskDescriptions[i]);

        // Mark task as in progress
        markTaskInProgress(currentImpl, spec.id, task.id);
        await saveImplementation(testDir, currentImpl);

        // Verify in_progress status persisted
        const inProgressImpl = JSON.parse(
          await readFile(
            join(testDir, ".ralph-wiggum", "implementation.json"),
            "utf-8"
          )
        ) as Implementation;
        const inProgressTask = inProgressImpl.specs[0].tasks.find(
          (t) => t.id === task.id
        );
        expect(inProgressTask?.status).toBe("in_progress");

        // Execute the mock agent (simulates task completion)
        const promptFile = join(testDir, `prompt-task-${i}.md`);
        const taskPrompt = generateTaskPrompt(spec, task);
        const result = await executeMockAgent(promptFile, taskPrompt, testDir);
        expect(result.status).toBe("done");

        // Mark task completed (simulating successful quality gates)
        markTaskCompleted(currentImpl, spec.id, task.id);
        await saveImplementation(testDir, currentImpl);

        // Verify completed status persisted immediately after each task
        const afterCompletionImpl = JSON.parse(
          await readFile(
            join(testDir, ".ralph-wiggum", "implementation.json"),
            "utf-8"
          )
        ) as Implementation;
        const completedTask = afterCompletionImpl.specs[0].tasks.find(
          (t) => t.id === task.id
        );
        expect(completedTask?.status).toBe("completed");
        expect(completedTask?.completedAt).toBeDefined();
      }

      // ===== ACCEPTANCE CRITERIA VERIFICATION =====
      // Given all 3 tasks complete successfully,
      // when build loop finishes,
      // then all 3 tasks show status 'completed' in implementation.json

      const finalImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;

      // 1. Verify all 3 tasks have status 'completed'
      const allTasks = finalImpl.specs[0].tasks;
      expect(allTasks.length).toBe(3);

      for (let i = 0; i < allTasks.length; i++) {
        const task = allTasks[i];
        expect(task.status).toBe("completed");
        expect(task.completedAt).toBeDefined();
        expect(task.description).toBe(taskDescriptions[i]);
      }

      // 2. Verify the spec itself is marked as completed (all tasks done)
      expect(finalImpl.specs[0].status).toBe("completed");

      // 3. Verify no tasks remain in pending or in_progress state
      const pendingTasks = allTasks.filter((t) => t.status === "pending");
      const inProgressTasks = allTasks.filter(
        (t) => t.status === "in_progress"
      );
      expect(pendingTasks.length).toBe(0);
      expect(inProgressTasks.length).toBe(0);

      // 4. Verify completedAt timestamps are valid ISO dates
      for (const task of allTasks) {
        expect(task.completedAt).toBeDefined();
        if (task.completedAt) {
          const completedAt = new Date(task.completedAt);
          expect(completedAt.toISOString()).toBe(task.completedAt);
        }
      }
    });
  });

  describe("Retry Context Injection", () => {
    it("quality gate failure triggers retry with failure output in prompt", async () => {
      // Setup: Create implementation with a single task
      const taskDescription = "Implement feature with type-safe code";
      const impl = createMockImplementation([taskDescription]);
      await saveImplementation(testDir, impl);

      // Get the task
      const currentImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;

      const next = getNextPendingTask(currentImpl);
      expect(next).not.toBeNull();
      if (!next) {
        throw new Error("Expected next task to exist");
      }

      const { spec, task } = next;

      // Simulate quality gate failure with specific TypeScript error
      const typecheckErrorOutput = `typecheck: error TS123
src/feature.ts:42:10 - error TS2322: Type 'number' is not assignable to type 'string'.

42   const value: string = 123;
              ~~~~~

Found 1 error in src/feature.ts`;

      const failedGates: QualityGateResult[] = [
        {
          name: "typecheck",
          passed: false,
          output: typecheckErrorOutput,
          exitCode: 1,
        },
      ];

      // Generate retry prompt with the failed gate context
      const retryPrompt = generateRetryPrompt(spec, task, failedGates, 0);

      // Execute the mock agent to capture the retry prompt
      const promptFile = join(testDir, "retry-prompt.md");
      await executeMockAgent(promptFile, retryPrompt, testDir);

      const capturedPrompt = await readFile(promptFile, "utf-8");

      // ===== ACCEPTANCE CRITERIA VERIFICATION =====
      // Given quality gates fail with 'typecheck: error TS123',
      // when retry spawns, then prompt includes 'typecheck: error TS123'

      // 1. Verify the retry prompt contains the specific error string
      expect(capturedPrompt).toContain("typecheck: error TS123");

      // 2. Verify the full error output is included in the prompt
      expect(capturedPrompt).toContain("error TS2322");
      expect(capturedPrompt).toContain(
        "Type 'number' is not assignable to type 'string'"
      );

      // 3. Verify retry prompt has the "Previous Attempt Failed" section
      expect(capturedPrompt).toContain("## ⚠️ Previous Attempt Failed");
      expect(capturedPrompt).toContain("This is retry attempt #1");

      // 4. Verify the gate name and exit code are shown
      expect(capturedPrompt).toContain("### typecheck (exit code 1)");

      // 5. Verify the error appears in a code block (for readability)
      expect(capturedPrompt).toContain("```");
      expect(capturedPrompt).toContain("src/feature.ts:42:10");

      // 6. Verify the base task prompt is still included
      expect(capturedPrompt).toContain(`# Task: ${taskDescription}`);
      expect(capturedPrompt).toContain("## Your Assignment");
      expect(capturedPrompt).toContain("Complete ONLY this task");
    });

    it("includes multiple failed gates in retry prompt", async () => {
      // Setup: Create implementation with a single task
      const taskDescription = "Build and lint the codebase";
      const impl = createMockImplementation([taskDescription]);
      await saveImplementation(testDir, impl);

      // Get the task
      const currentImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;

      const next = getNextPendingTask(currentImpl);
      expect(next).not.toBeNull();
      if (!next) {
        throw new Error("Expected next task to exist");
      }

      const { spec, task } = next;

      // Simulate multiple quality gate failures
      const failedGates: QualityGateResult[] = [
        {
          name: "typecheck",
          passed: false,
          output: "typecheck: error TS123\nType error in module.ts",
          exitCode: 1,
        },
        {
          name: "lint",
          passed: false,
          output:
            "lint: 5 errors found\n  - Unused variable 'x'\n  - Missing semicolon",
          exitCode: 1,
        },
      ];

      // Generate retry prompt with multiple failed gates
      const retryPrompt = generateRetryPrompt(spec, task, failedGates, 1);

      // Execute the mock agent to capture the retry prompt
      const promptFile = join(testDir, "retry-prompt-multi.md");
      await executeMockAgent(promptFile, retryPrompt, testDir);

      const capturedPrompt = await readFile(promptFile, "utf-8");

      // Verify both gate failures are included
      expect(capturedPrompt).toContain("### typecheck (exit code 1)");
      expect(capturedPrompt).toContain("typecheck: error TS123");
      expect(capturedPrompt).toContain("### lint (exit code 1)");
      expect(capturedPrompt).toContain("lint: 5 errors found");
      expect(capturedPrompt).toContain("Missing semicolon");

      // Verify retry attempt number is correct (second retry = attempt #2)
      expect(capturedPrompt).toContain("This is retry attempt #2");
    });
  });

  describe("Blocked Task Handling", () => {
    it("blocked task gets marked with reason from TASK_BLOCKED marker", async () => {
      // Setup: Create implementation with a single task
      const taskDescription = "Integrate external payment API";
      const impl = createMockImplementation([taskDescription]);
      await saveImplementation(testDir, impl);

      // Verify initial state
      const initialImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;
      expect(initialImpl.specs[0].tasks[0].status).toBe("pending");
      expect(initialImpl.specs[0].tasks[0].blockedReason).toBeUndefined();

      // Get the task
      const currentImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;

      const next = getNextPendingTask(currentImpl);
      expect(next).not.toBeNull();
      if (!next) {
        throw new Error("Expected next task to exist");
      }

      const { spec, task } = next;

      // Mark task as in progress (mimics actual loop behavior)
      markTaskInProgress(currentImpl, spec.id, task.id);
      await saveImplementation(testDir, currentImpl);

      // Execute the mock agent with blocked response and specific reason
      const blockedReason = "missing API key";
      const promptFile = join(testDir, "prompt-blocked-task.md");
      const taskPrompt = generateTaskPrompt(spec, task);
      const result = await executeMockAgent(promptFile, taskPrompt, testDir, {
        response: "blocked",
        blockedReason,
      });

      // Verify agent returned blocked status with reason
      expect(result.status).toBe("blocked");
      expect(result.reason).toBe(blockedReason);
      expect(result.output).toContain(
        `<TASK_BLOCKED reason="${blockedReason}">`
      );

      // Mark task as blocked with the extracted reason (simulates handleBlockedTask in start.ts)
      markTaskBlocked(
        currentImpl,
        spec.id,
        task.id,
        result.reason || "Unknown"
      );
      await saveImplementation(testDir, currentImpl);

      // ===== ACCEPTANCE CRITERIA VERIFICATION =====
      // Given agent outputs '<TASK_BLOCKED reason="missing API key">',
      // when build loop processes,
      // then task status is 'blocked' with blockedReason 'missing API key'

      const finalImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;

      const blockedTask = finalImpl.specs[0].tasks.find(
        (t) => t.id === task.id
      );

      // 1. Verify task status is 'blocked'
      expect(blockedTask?.status).toBe("blocked");

      // 2. Verify blockedReason matches the reason from TASK_BLOCKED marker
      expect(blockedTask?.blockedReason).toBe(blockedReason);

      // 3. Verify task is not marked as completed
      expect(blockedTask?.completedAt).toBeUndefined();

      // 4. Verify spec status is NOT completed (still has blocked task)
      expect(finalImpl.specs[0].status).not.toBe("completed");
    });

    it("blocked task preserves reason with special characters", async () => {
      // Setup: Create implementation with a task
      const taskDescription = "Configure database connection";
      const impl = createMockImplementation([taskDescription]);
      await saveImplementation(testDir, impl);

      // Get the task
      const currentImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;

      const next = getNextPendingTask(currentImpl);
      expect(next).not.toBeNull();
      if (!next) {
        throw new Error("Expected next task to exist");
      }

      const { spec, task } = next;
      markTaskInProgress(currentImpl, spec.id, task.id);
      await saveImplementation(testDir, currentImpl);

      // Execute with a reason containing special characters
      const blockedReason = "DB_HOST env var not set in .env file";
      const promptFile = join(testDir, "prompt-blocked-special.md");
      const taskPrompt = generateTaskPrompt(spec, task);
      const result = await executeMockAgent(promptFile, taskPrompt, testDir, {
        response: "blocked",
        blockedReason,
      });

      expect(result.status).toBe("blocked");
      expect(result.reason).toBe(blockedReason);

      // Mark task as blocked
      markTaskBlocked(
        currentImpl,
        spec.id,
        task.id,
        result.reason || "Unknown"
      );
      await saveImplementation(testDir, currentImpl);

      // Verify the reason is preserved exactly
      const finalImpl = JSON.parse(
        await readFile(
          join(testDir, ".ralph-wiggum", "implementation.json"),
          "utf-8"
        )
      ) as Implementation;

      const blockedTask = finalImpl.specs[0].tasks[0];
      expect(blockedTask.status).toBe("blocked");
      expect(blockedTask.blockedReason).toBe(blockedReason);
    });
  });
});
