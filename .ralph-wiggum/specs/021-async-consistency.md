# Fix Async/Await Consistency

## Problem to solve

As a developer reading the codebase, I want consistent async patterns, so I don't have to wonder "why is this written differently?" when I see:

```typescript
// Pattern A: Explicit Promise.resolve (why?)
checkInstalled(): Promise<boolean> {
  try {
    execSync("which claude", { stdio: "pipe" });
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

// Pattern B: Async/await (normal)
async checkInstalled(): Promise<boolean> {
  try {
    execSync("which claude", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
```

Both work, but Pattern A makes readers ask "is there a reason for this?" — mental overhead for no benefit.

## Intended users

- Developers reading agent implementations
- Contributors adding new agents
- Anyone reviewing code consistency

## User experience goal

A developer should see one consistent async pattern across all similar functions. When they see `async`, they know it might `await` something. When they see a synchronous function returning `Promise.resolve()`, they should question if it should be async.

## Proposal

### Rule: Use `async` When Returning Promises

If a function returns `Promise<T>`, make it `async` unless there's a specific reason not to (e.g., returning a cached promise).

### Files to Update

All agent files follow the same pattern:

```typescript
// src/agents/claude.ts, amp.ts, droid.ts, etc.

// Before
checkInstalled(): Promise<boolean> {
  try {
    execSync("which claude", { stdio: "pipe" });
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

// After
async checkInstalled(): Promise<boolean> {
  try {
    execSync("which claude", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
```

### Bonus: Consider Making Check Actually Async

The `checkInstalled()` method uses `execSync` which blocks. For consistency with the async signature, consider using `exec` with promisify:

```typescript
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async checkInstalled(): Promise<boolean> {
  try {
    await execAsync("which claude");
    return true;
  } catch {
    return false;
  }
}
```

This is optional but makes the `async` keyword meaningful.

## Tasks

- [ ] Update `ClaudeAgent.checkInstalled()` to use `async`
- [ ] Update `AmpAgent.checkInstalled()` to use `async`
- [ ] Update `DroidAgent.checkInstalled()` to use `async`
- [ ] Update `OpenCodeAgent.checkInstalled()` to use `async`
- [ ] Update `CursorAgent.checkInstalled()` to use `async`
- [ ] Update `CodexAgent.checkInstalled()` to use `async`
- [ ] Update `GeminiAgent.checkInstalled()` to use `async`
- [ ] Update `PiAgent.checkInstalled()` to use `async`
- [ ] (Optional) Convert `execSync` to `execAsync` in all agents
- [ ] Run tests to verify no regressions
- [ ] Run typecheck to ensure signatures are correct

## Acceptance Criteria

- [ ] Given I search for `Promise.resolve(true)` in agents/, when I search, then zero results are found
- [ ] Given I search for `Promise.resolve(false)` in agents/, when I search, then zero results are found
- [ ] Given I look at any agent's `checkInstalled()`, when I read it, then it uses `async` keyword
- [ ] Given I run `bun test`, when tests complete, then all agent tests pass
- [ ] Given I run `bun run typecheck`, when it completes, then no errors

## Success Metrics

- All 8 agents use consistent async pattern
- No `Promise.resolve()` calls in agent files
- Code reads more naturally

## Testing Requirements

- [ ] Existing agent tests must pass
- [ ] No new tests needed (behavior unchanged)

## Notes

### Why This Matters

Ruby has a principle: "There should be one obvious way to do things."

When there are multiple ways to write the same code, readers waste mental energy asking "why this way?" Good code minimizes these questions.

### The Abstract Method Signature

The base class already declares:

```typescript
abstract checkInstalled(): Promise<boolean>;
```

Both `async checkInstalled()` and `checkInstalled(): Promise<boolean>` satisfy this, but `async` is clearer.

### Edge Case: Cached Results

If we ever want to cache installation status:

```typescript
private installedCache: boolean | null = null;

async checkInstalled(): Promise<boolean> {
  if (this.installedCache !== null) {
    return this.installedCache;
  }
  // ... check and cache
}
```

This still uses `async` because the method signature promises async behavior, even if some calls are synchronous.
