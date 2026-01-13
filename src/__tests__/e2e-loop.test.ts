import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAllAgents } from "../agents/index.js";

const MOCK_AGENT_SCRIPT = `#!/usr/bin/env node
// Mock agent that reads stdin and outputs structured JSON
// Simulates 3 iterations before signaling DONE

const fs = require('fs');
const path = require('path');

// Read the counter file to track iterations
const counterFile = process.env.MOCK_COUNTER_FILE;
let count = 0;
try {
  count = parseInt(fs.readFileSync(counterFile, 'utf-8'), 10);
} catch {}

count++;
fs.writeFileSync(counterFile, count.toString());

// Read stdin (the prompt)
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  // Output JSON like the real agents do
  console.log(JSON.stringify({ type: 'message', iteration: count }));
  
  if (count >= 3) {
    // Signal completion on 3rd iteration
    console.log('<STATUS>DONE</STATUS>');
  }
  
  process.exit(0);
});
`;

describe("E2E Loop Tests", () => {
  let testDir: string;
  let mockAgentPath: string;
  let counterFile: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "ralph-e2e-"));
    mockAgentPath = join(testDir, "mock-agent.js");
    counterFile = join(testDir, "counter");

    await writeFile(mockAgentPath, MOCK_AGENT_SCRIPT, { mode: 0o755 });
    await writeFile(counterFile, "0");

    await mkdir(join(testDir, ".ralph"));
    await writeFile(
      join(testDir, ".ralph", "config.json"),
      JSON.stringify({ agent: "claude", model: "test" })
    );
    await writeFile(
      join(testDir, ".ralph", "PROMPT_plan.md"),
      "Test prompt for planning"
    );
    await writeFile(
      join(testDir, ".ralph", "PROMPT_build.md"),
      "Test prompt for building"
    );
    await mkdir(join(testDir, ".ralph", "logs"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("Loop continues past iteration 1", () => {
    it("runs multiple iterations before DONE marker", async () => {
      const result = await runMockLoop(testDir, mockAgentPath, counterFile);

      expect(result.iterations).toBeGreaterThan(1);
      expect(result.iterations).toBe(3);
      expect(result.doneDetected).toBe(true);
    });

    it("respects maxIterations limit", async () => {
      const result = await runMockLoop(testDir, mockAgentPath, counterFile, 2);

      expect(result.iterations).toBe(2);
      expect(result.doneDetected).toBe(false);
    });
  });

  describe("Agent command verification", () => {
    const AGENTS_MISSING_PERMISSION_BYPASS = ["opencode"];
    const AGENTS_MISSING_NON_INTERACTIVE: string[] = [];

    for (const agent of getAllAgents()) {
      const skipPermissionCheck = AGENTS_MISSING_PERMISSION_BYPASS.includes(
        agent.type
      );
      const skipNonInteractiveCheck = AGENTS_MISSING_NON_INTERACTIVE.includes(
        agent.type
      );

      it(`${agent.name} buildCommand includes permission bypass flags${skipPermissionCheck ? " (KNOWN GAP)" : ""}`, () => {
        const cmd = agent.buildCommand({
          promptFile: "/test/prompt.md",
        });

        const argsStr = cmd.args.join(" ");

        const hasPermissionBypass =
          argsStr.includes("dangerously") ||
          argsStr.includes("skip-permission") ||
          argsStr.includes("yolo") ||
          argsStr.includes("auto") ||
          argsStr.includes("trust") ||
          argsStr.includes("unsafe") ||
          argsStr.includes("-f") ||
          argsStr.includes("--force") ||
          argsStr.includes("approve");

        if (skipPermissionCheck) {
          if (!hasPermissionBypass) {
            console.warn(
              `⚠️  ${agent.name} missing permission bypass - may interrupt loop`
            );
          }
          return;
        }

        expect(hasPermissionBypass).toBe(true);
      });

      it(`${agent.name} buildCommand includes non-interactive mode${skipNonInteractiveCheck ? " (KNOWN GAP)" : ""}`, () => {
        const cmd = agent.buildCommand({
          promptFile: "/test/prompt.md",
        });

        const argsStr = cmd.args.join(" ");

        const hasNonInteractive =
          argsStr.includes("-p") ||
          argsStr.includes("exec") ||
          argsStr.includes("run") ||
          argsStr.includes("--execute") ||
          argsStr.includes("--yolo");

        if (skipNonInteractiveCheck) {
          if (!hasNonInteractive) {
            console.warn(
              `⚠️  ${agent.name} missing non-interactive mode - may hang`
            );
          }
          return;
        }

        expect(hasNonInteractive).toBe(true);
      });

      it(`${agent.name} buildCommand includes JSON output format`, () => {
        const cmd = agent.buildCommand({
          promptFile: "/test/prompt.md",
        });

        const argsStr = cmd.args.join(" ");

        const hasJsonOutput =
          argsStr.includes("json") || argsStr.includes("stream-json");

        expect(hasJsonOutput).toBe(true);
      });
    }
  });
});

function runMockLoop(
  projectDir: string,
  mockAgentPath: string,
  counterFile: string,
  maxIterations = 10
): Promise<{ iterations: number; doneDetected: boolean; output: string }> {
  return new Promise((resolve, reject) => {
    let iterations = 0;
    let doneDetected = false;
    let output = "";

    const runIteration = async () => {
      if (iterations >= maxIterations) {
        resolve({ iterations, doneDetected, output });
        return;
      }

      const promptPath = join(projectDir, ".ralph", "PROMPT_plan.md");
      const promptContent = await readFile(promptPath, "utf-8");

      const child = spawn("node", [mockAgentPath], {
        cwd: projectDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, MOCK_COUNTER_FILE: counterFile },
      });

      child.stdin.write(promptContent);
      child.stdin.end();

      let stdout = "";
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.on("close", (code) => {
        iterations++;
        output += stdout;

        if (stdout.includes("<STATUS>DONE</STATUS>")) {
          doneDetected = true;
          resolve({ iterations, doneDetected, output });
          return;
        }

        if (code !== 0) {
          reject(new Error(`Mock agent exited with code ${code}`));
          return;
        }

        runIteration();
      });

      child.on("error", reject);
    };

    runIteration();
  });
}
