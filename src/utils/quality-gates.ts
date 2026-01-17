// src/utils/quality-gates.ts
// External quality gate runner for task-level orchestration

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { QualityGate, QualityGateResult } from "../types";

const execAsync = promisify(exec);

const WHITESPACE_REGEX = /\s+/;

/**
 * Parse quality gate commands from string array to QualityGate objects.
 * Gate name is extracted from the last word of the command.
 * All parsed gates are marked as required.
 *
 * @example
 * parseQualityGates(['bun run typecheck', 'bun run test'])
 * // Returns: [
 * //   { name: 'typecheck', command: 'bun run typecheck', required: true },
 * //   { name: 'test', command: 'bun run test', required: true }
 * // ]
 */
export function parseQualityGates(commands: string[]): QualityGate[] {
  return commands.map((command) => {
    const trimmed = command.trim();
    const words = trimmed.split(WHITESPACE_REGEX);
    const name = words.at(-1) || trimmed;
    return {
      name,
      command: trimmed,
      required: true,
    };
  });
}

/**
 * Run a single quality gate and return the result.
 */
export async function runQualityGate(
  gate: QualityGate,
  cwd: string,
  timeoutMs = 120_000
): Promise<QualityGateResult> {
  try {
    const { stdout, stderr } = await execAsync(gate.command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return {
      name: gate.name,
      passed: true,
      output: stdout + stderr,
      exitCode: 0,
    };
  } catch (error: unknown) {
    const execError = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    return {
      name: gate.name,
      passed: false,
      output:
        (execError.stdout || "") +
        (execError.stderr || "") +
        (execError.message || ""),
      exitCode: execError.code ?? 1,
    };
  }
}

/**
 * Run all quality gates in order and return results.
 * Stops on first required gate failure.
 */
export async function runQualityGates(
  gates: QualityGate[],
  cwd: string,
  options: {
    onGateStart?: (gate: QualityGate) => void;
    onGateComplete?: (result: QualityGateResult) => void;
    stopOnRequiredFailure?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<QualityGateResult[]> {
  const results: QualityGateResult[] = [];
  const { stopOnRequiredFailure = true, timeoutMs = 120_000 } = options;

  for (const gate of gates) {
    options.onGateStart?.(gate);

    const result = await runQualityGate(gate, cwd, timeoutMs);
    results.push(result);

    options.onGateComplete?.(result);

    if (!result.passed && gate.required && stopOnRequiredFailure) {
      break;
    }
  }

  return results;
}

/**
 * Check if all required gates passed.
 */
export function allRequiredGatesPassed(
  results: QualityGateResult[],
  gates: QualityGate[]
): boolean {
  const requiredGates = new Set(
    gates.filter((g) => g.required).map((g) => g.name)
  );

  for (const result of results) {
    if (requiredGates.has(result.name) && !result.passed) {
      return false;
    }
  }

  return true;
}

/**
 * Get failed gates from results.
 */
export function getFailedGates(
  results: QualityGateResult[]
): QualityGateResult[] {
  return results.filter((r) => !r.passed);
}

/**
 * Format quality gate results for logging/display.
 */
export function formatGateResults(results: QualityGateResult[]): string {
  return results
    .map((r) => {
      const status = r.passed ? "✓" : "✗";
      return `${status} ${r.name}`;
    })
    .join("\n");
}

/**
 * Create a summary of quality gate results.
 */
export function getGateSummary(results: QualityGateResult[]): {
  passed: number;
  failed: number;
  total: number;
} {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  return { passed, failed, total: results.length };
}
