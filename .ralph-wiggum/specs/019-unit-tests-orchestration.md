# Add Unit Tests for Orchestration Layer

## Problem to solve

As a maintainer, I want unit tests for each orchestration function, so I can refactor with confidence and catch regressions at the function level rather than only through integration tests.

Currently, `start.ts` has no direct unit tests. The 885-line `task-level-loop.test.ts` tests the entire loop end-to-end, which is valuable but:

1. Slow to run (spawns processes, writes files)
2. Hard to isolate failures (which function broke?)
3. Doesn't test edge cases in individual handlers

After spec 016, we'll have isolated modules that deserve their own tests.

## Intended users

- Developers refactoring orchestration code
- CI pipeline catching regressions early
- Contributors understanding expected behavior through test cases

## User experience goal

A developer should be able to run `bun test orchestration/` and get fast feedback (<1s) on whether individual orchestration functions work correctly.

## Proposal

### Test Structure

```
src/orchestration/
├── __tests__/
│   ├── task-handlers.test.ts    # Unit tests for handlers
│   ├── agent-executor.test.ts   # Unit tests for execution
│   └── notifications.test.ts    # Unit tests for notifications
├── task-loop.ts
├── task-handlers.ts
├── agent-executor.ts
└── notifications.ts
```

### Testing Strategy

**1. Pure Function Tests (No Mocking)**

Handler functions that transform data can be tested directly:

```typescript
// task-handlers.test.ts
describe('handleBlockedTask', () => {
  it('marks task as blocked with reason', async () => {
    const impl = createMockImplementation(['Task 1']);
    const spec = impl.specs[0];
    const task = spec.tasks[0];
    
    await handleBlockedTask(impl, spec, task, 'Missing API key', mockContext);
    
    expect(task.status).toBe('blocked');
    expect(task.blockedReason).toBe('Missing API key');
  });
});
```

**2. Dependency Injection for I/O**

Functions that do I/O should accept dependencies:

```typescript
// Current: hard to test
async function handleGatesPassed(...) {
  await saveImplementation(projectPath, impl); // Direct call
}

// Better: inject the dependency
async function handleGatesPassed(ctx: LoopContext, ...) {
  await ctx.saveImplementation(impl); // Mockable
}
```

**3. Test Doubles for Agent Executor**

The agent executor spawns processes. Create a test double:

```typescript
// __tests__/fixtures/mock-executor.ts
export function createMockExecutor(responses: TaskResult[]): AgentExecutor {
  let callIndex = 0;
  return {
    execute: async () => responses[callIndex++],
  };
}
```

### Test Cases Per Module

**`task-handlers.test.ts`**
- `handleBlockedTask()` — marks task blocked, saves implementation
- `handleGatesPassed()` — marks task completed, checks spec completion
- `handleGatesFailed()` — increments retry count, resets to pending
- `handleTaskError()` — marks task failed, sends notification
- `handleDoneResult()` — runs quality gates, routes to pass/fail handlers

**`agent-executor.test.ts`**
- `executeAgentWithPrompt()` — returns done/blocked/error based on output
- `runSingleTask()` — generates correct prompt, calls executor
- `runRetryTask()` — includes failure context in prompt

**`notifications.test.ts`**
- `notifyTelegram()` — sends notification when enabled
- `notifyTelegram()` — skips when disabled
- `notifyTelegram()` — handles API errors gracefully
- `getGitBranch()` — returns branch name or undefined

## Tasks

- [ ] Create `src/orchestration/__tests__/` directory
- [ ] Create `task-handlers.test.ts` with test suite
- [ ] Create `agent-executor.test.ts` with test suite
- [ ] Create `notifications.test.ts` with test suite
- [ ] Create `__tests__/fixtures/mock-executor.ts` for test doubles
- [ ] Add tests for `handleBlockedTask()` (3 cases)
- [ ] Add tests for `handleGatesPassed()` (3 cases)
- [ ] Add tests for `handleGatesFailed()` (4 cases: retry 1/2/3, max exceeded)
- [ ] Add tests for `handleTaskError()` (2 cases)
- [ ] Add tests for `handleDoneResult()` (3 cases: no gates, pass, fail)
- [ ] Add tests for `executeAgentWithPrompt()` (4 cases: done, blocked, error, timeout)
- [ ] Add tests for `notifyTelegram()` (3 cases)
- [ ] Add tests for `getGitBranch()` (2 cases)
- [ ] Ensure all new tests run in <1s total
- [ ] Update CI to run orchestration tests

## Acceptance Criteria

- [ ] Given I run `bun test src/orchestration/`, when tests complete, then at least 20 unit tests pass
- [ ] Given I run `bun test src/orchestration/`, when tests complete, then total time is under 1 second
- [ ] Given I break `handleBlockedTask()` logic, when I run its tests, then the specific test fails (not integration)
- [ ] Given I read `task-handlers.test.ts`, when I look at test names, then I understand what each handler does
- [ ] Given I run `bun test`, when all tests complete, then total count is 230+ (211 + new tests)

## Success Metrics

- 20+ new unit tests for orchestration layer
- Unit tests run in <1s (vs ~2s for full suite)
- Each handler function has at least 2 test cases
- Test names describe behavior in plain English

## Testing Requirements

This IS the testing spec — meta!

- [ ] Tests use Bun's test runner (`bun:test`)
- [ ] Tests follow existing patterns in `__tests__/` folders
- [ ] Tests use `beforeEach` for setup, not shared mutable state
- [ ] Tests clean up any temp files they create

## Notes

### Example Test Cases

```typescript
// task-handlers.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { handleBlockedTask } from '../task-handlers';
import { createMockContext, createMockImplementation } from './fixtures';

describe('handleBlockedTask', () => {
  let ctx: LoopContext;
  let impl: Implementation;

  beforeEach(() => {
    ctx = createMockContext();
    impl = createMockImplementation(['Task 1', 'Task 2']);
  });

  it('marks task status as blocked', async () => {
    const spec = impl.specs[0];
    const task = spec.tasks[0];

    await handleBlockedTask(ctx, impl, spec, task, 'Missing credentials');

    expect(task.status).toBe('blocked');
  });

  it('stores the blocked reason', async () => {
    const spec = impl.specs[0];
    const task = spec.tasks[0];

    await handleBlockedTask(ctx, impl, spec, task, 'Missing credentials');

    expect(task.blockedReason).toBe('Missing credentials');
  });

  it('saves implementation to disk', async () => {
    const spec = impl.specs[0];
    const task = spec.tasks[0];

    await handleBlockedTask(ctx, impl, spec, task, 'Missing credentials');

    expect(ctx.saveImplementation).toHaveBeenCalledWith(impl);
  });
});
```

### Test Double Pattern

```typescript
// __tests__/fixtures/index.ts
export function createMockContext(overrides?: Partial<LoopContext>): LoopContext {
  return {
    projectPath: '/tmp/test-project',
    config: createMockConfig(),
    session: createMockSession(),
    agent: createMockAgent(),
    log: vi.fn(),
    saveImplementation: vi.fn(),
    ...overrides,
  };
}
```

### Why Not Mock Everything?

Keep tests grounded in reality:
- Use real `Implementation` objects (they're just data)
- Use real `markTaskBlocked()` etc. (they're pure functions)
- Only mock I/O: file writes, process spawning, network calls
