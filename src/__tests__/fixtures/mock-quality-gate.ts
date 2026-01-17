#!/usr/bin/env bun
/**
 * Mock Quality Gate Script
 *
 * A test utility that simulates a quality gate command for task-level build loop integration tests.
 * This script returns configurable exit codes and outputs mock failure messages.
 *
 * Environment Variables:
 * - MOCK_GATE_EXIT_CODE: Exit code to return (default: 0)
 * - MOCK_GATE_NAME: Name of the gate for failure messages (default: "typecheck")
 * - MOCK_GATE_OUTPUT: Custom output message (optional, uses default if not set)
 *
 * Usage:
 *   MOCK_GATE_EXIT_CODE=0 bun src/__tests__/fixtures/mock-quality-gate.ts  # Success
 *   MOCK_GATE_EXIT_CODE=1 bun src/__tests__/fixtures/mock-quality-gate.ts  # Failure with default message
 *   MOCK_GATE_EXIT_CODE=1 MOCK_GATE_NAME=lint MOCK_GATE_OUTPUT="Custom error" bun src/__tests__/fixtures/mock-quality-gate.ts
 */

const exitCode = Number.parseInt(process.env.MOCK_GATE_EXIT_CODE || "0", 10);
const gateName = process.env.MOCK_GATE_NAME || "typecheck";
const customOutput = process.env.MOCK_GATE_OUTPUT;

if (exitCode === 0) {
  // Success case
  console.log(`${gateName}: All checks passed`);
  process.exit(0);
} else {
  // Failure case - output mock failure messages
  const defaultFailureOutput = `${gateName} failed with exit code ${exitCode}

error: Mock failure in ${gateName}
  at src/example.ts:42:10
  
    42 | const value: string = 123;
       |       ^^^^^
       
Type 'number' is not assignable to type 'string'.

Found 1 error in src/example.ts`;

  const output = customOutput || defaultFailureOutput;

  // Write to stderr for errors (mimics real tools)
  console.error(output);
  process.exit(exitCode);
}
