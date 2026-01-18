# Centralize Constants & Magic Strings

## Problem to solve

As a developer modifying prompt formats or markers, I want all magic strings in one place, so I can make changes confidently without grep-ing the entire codebase.

Currently, magic strings are scattered:

```typescript
// start.ts
const DONE_MARKER = "<STATUS>DONE</STATUS>";
const TASK_DONE_MARKER = "<TASK_DONE>";
const TASK_BLOCKED_REGEX = /<TASK_BLOCKED\s+reason="([^"]+)">/;

// task-level-loop.test.ts (duplicated!)
const TASK_BLOCKED_REGEX = /<TASK_BLOCKED\s+reason="([^"]+)">/;

// task-prompts.ts
"When done, output exactly: <TASK_DONE>"
"If blocked, output: <TASK_BLOCKED reason=\"...\">"
```

If I change the marker format, I need to update 4+ files and hope I didn't miss any.

## Intended users

- Developers modifying task completion markers
- Developers adding new marker types
- Test authors who need to simulate agent output

## User experience goal

A developer should be able to change a marker format in ONE file and have it propagate everywhere — prompts, parsers, and tests.

## Proposal

### Create `src/constants.ts`

Single source of truth for all application constants:

```typescript
// src/constants.ts

// ============================================
// Task Markers (used in prompts and parsing)
// ============================================

export const MARKERS = {
  TASK_DONE: "<TASK_DONE>",
  TASK_BLOCKED_TEMPLATE: '<TASK_BLOCKED reason="...">',
  TASK_BLOCKED_REGEX: /<TASK_BLOCKED\s+reason="([^"]+)">/,
} as const;

// ============================================
// File Names & Paths
// ============================================

export const FILES = {
  CONFIG: "config.json",
  IMPLEMENTATION: "implementation.json",
  PROMPT_PLAN: "PROMPT_plan.md",
  GUARDRAILS: "GUARDRAILS.md",
  PROGRESS: "PROGRESS.md",
} as const;

// ============================================
// Default Values
// ============================================

export const DEFAULTS = {
  MAX_RETRIES: 3,
  GRACEFUL_SHUTDOWN_MS: 5000,
  DEFAULT_AGENT: "claude" as const,
} as const;

// ============================================
// Quality Gates
// ============================================

export const DEFAULT_QUALITY_GATES = [
  "bun run typecheck",
  "bun run lint",
  "bun run test",
  "bun run build",
] as const;
```

### Update Consumers

1. **`orchestration/agent-executor.ts`** — import `MARKERS`
2. **`utils/task-prompts.ts`** — import `MARKERS` for prompt text
3. **`utils/implementation.ts`** — import `DEFAULT_QUALITY_GATES`
4. **`utils/paths.ts`** — import `FILES`
5. **`tui/lib/constants.ts`** — already has TUI constants, keep separate
6. **Test files** — import from `src/constants.ts`

### Marker Generation Helper

Add a helper to generate blocked marker with reason:

```typescript
export function formatBlockedMarker(reason: string): string {
  return `<TASK_BLOCKED reason="${reason}">`;
}

export function parseBlockedMarker(output: string): string | null {
  const match = output.match(MARKERS.TASK_BLOCKED_REGEX);
  return match?.[1] ?? null;
}
```

## Tasks

- [ ] Create `src/constants.ts` with all constants
- [ ] Add `MARKERS` object with task markers
- [ ] Add `FILES` object with file names
- [ ] Add `DEFAULTS` object with default values
- [ ] Add `DEFAULT_QUALITY_GATES` array
- [ ] Add `formatBlockedMarker()` helper function
- [ ] Add `parseBlockedMarker()` helper function
- [ ] Update `orchestration/agent-executor.ts` to use `MARKERS`
- [ ] Update `utils/task-prompts.ts` to use `MARKERS`
- [ ] Update `utils/implementation.ts` to use `DEFAULT_QUALITY_GATES`
- [ ] Update `utils/paths.ts` to use `FILES` (if applicable)
- [ ] Update `task-level-loop.test.ts` to import from `constants.ts`
- [ ] Delete duplicate regex definitions from test files
- [ ] Run tests to verify no regressions

## Acceptance Criteria

- [ ] Given I search for `<TASK_DONE>` as a string literal, when I search outside `constants.ts`, then zero results are found
- [ ] Given I search for `TASK_BLOCKED` regex pattern, when I search outside `constants.ts`, then zero results are found
- [ ] Given I change `MARKERS.TASK_DONE` value, when I run tests, then tests use the new value automatically
- [ ] Given I run `bun test`, when tests complete, then all tests pass
- [ ] Given I run `bun run typecheck`, when it completes, then no type errors

## Success Metrics

- All magic strings defined in exactly one file
- Zero string literal duplications for markers
- Tests import constants instead of redefining them

## Testing Requirements

- [ ] Existing tests pass without behavior changes
- [ ] Tests import `MARKERS` from `src/constants.ts`
- [ ] Add one unit test for `parseBlockedMarker()` helper

## Notes

### What Stays in `tui/lib/constants.ts`

The TUI has its own constants file for theme colors and timing. Keep it separate:

```typescript
// tui/lib/constants.ts — TUI-specific only
export const TOKYO_NIGHT = { ... };
export const TIMING = { POLL_INTERVAL_MS: 2000, ... };
```

### Migration Checklist

Files to update:
- [x] `src/constants.ts` (create)
- [ ] `src/commands/start.ts` → `orchestration/agent-executor.ts`
- [ ] `src/utils/task-prompts.ts`
- [ ] `src/utils/implementation.ts`
- [ ] `src/__tests__/task-level-loop.test.ts`
- [ ] `src/tui/hooks/__tests__/use-task-manager.test.ts` (if applicable)

### Example: Before/After

```typescript
// Before: task-prompts.ts
return `...
When done, output exactly: <TASK_DONE>
If blocked, output: <TASK_BLOCKED reason="...">
`;

// After: task-prompts.ts
import { MARKERS } from '../constants';

return `...
When done, output exactly: ${MARKERS.TASK_DONE}
If blocked, output: ${MARKERS.TASK_BLOCKED_TEMPLATE}
`;
```
