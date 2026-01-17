#!/usr/bin/env bun
/**
 * Mock Task Agent Script
 *
 * A test utility that simulates an AI agent for task-level build loop integration tests.
 * This script:
 * 1. Captures the prompt from stdin and writes it to a temp file
 * 2. Outputs configurable task markers (<TASK_DONE> or <TASK_BLOCKED>)
 *
 * Environment Variables:
 * - MOCK_PROMPT_FILE: Path to write the received prompt (required)
 * - MOCK_RESPONSE: "done" | "blocked" (default: "done")
 * - MOCK_BLOCKED_REASON: Reason string for blocked response (default: "Unknown reason")
 *
 * Usage:
 *   echo "prompt content" | MOCK_PROMPT_FILE=/tmp/prompt.txt bun src/__tests__/fixtures/mock-task-agent.ts
 *   echo "prompt content" | MOCK_PROMPT_FILE=/tmp/prompt.txt MOCK_RESPONSE=blocked MOCK_BLOCKED_REASON="missing dep" bun src/__tests__/fixtures/mock-task-agent.ts
 */

import { writeFileSync } from "node:fs";

async function main() {
  const promptFile = process.env.MOCK_PROMPT_FILE;
  const response = process.env.MOCK_RESPONSE || "done";
  const blockedReason = process.env.MOCK_BLOCKED_REASON || "Unknown reason";

  if (!promptFile) {
    console.error("ERROR: MOCK_PROMPT_FILE environment variable is required");
    process.exit(1);
  }

  // Read prompt from stdin using Bun's stdin API
  // biome-ignore lint/correctness/noUndeclaredVariables: Bun is a global in Bun runtime
  const reader = Bun.stdin.stream().getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
  }

  const prompt = Buffer.concat(chunks).toString("utf-8");

  // Write prompt to file for test assertions
  writeFileSync(promptFile, prompt, "utf-8");

  // Output some JSON to simulate agent output (like real agents do)
  console.log(
    JSON.stringify({ type: "message", content: "Mock agent processing..." })
  );

  // Output the configured marker
  if (response === "blocked") {
    console.log(`<TASK_BLOCKED reason="${blockedReason}">`);
  } else {
    console.log("<TASK_DONE>");
  }
}

main().catch((err) => {
  console.error("Mock agent error:", err);
  process.exit(1);
});
