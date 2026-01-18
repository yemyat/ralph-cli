# Introduce Options Object Pattern

## Problem to solve

As a developer reading the codebase, I want functions to have clear, scannable signatures, so I can understand what a function does without counting positional parameters.

Current function signatures are hard to read:

```typescript
// 10 positional parameters — what is the 7th one?
function runRetryTask(
  projectPath: string,
  spec: SpecEntry,
  task: TaskEntry,
  failedGates: QualityGateResult[],
  retryCount: number,
  agentInstance: ReturnType<typeof getAgent>,
  session: RalphSession,
  log: (msg: string) => void,
  verbose?: boolean,
  onSpawn?: (child: ReturnType<typeof spawn>) => void
): Promise<TaskResult>
```

This violates Ruby's principle: "Code should read like English prose."

## Intended users

- Developers calling these functions
- Developers reading code that calls these functions
- IDE users relying on autocomplete

## User experience goal

A developer should be able to read a function call and immediately understand what each argument represents without jumping to the function definition.

## Proposal

### Pattern: Named Options Object

Replace positional parameters with a single options object when a function has more than 3 parameters:

```typescript
// Before
await runRetryTask(projectPath, spec, task, failedGates, 2, agent, session, log, true);

// After
await runRetryTask({
  spec,
  task,
  failedGates,
  retryCount: 2,
  verbose: true,
});
```

### Shared Context Pattern

Functions in the orchestration layer share common dependencies. Extract these into a `LoopContext`:

```typescript
interface LoopContext {
  projectPath: string;
  session: RalphSession;
  agent: BaseAgent;
  log: (msg: string) => void;
  verbose?: boolean;
}

// Functions receive context + task-specific options
function runSingleTask(ctx: LoopContext, task: TaskEntry, spec: SpecEntry): Promise<TaskResult>
```

### Files to Refactor

1. **`orchestration/agent-executor.ts`** (after spec 016)
   - `executeAgentWithPrompt()` → `ExecuteOptions`
   - `runSingleTask()` → uses `LoopContext`
   - `runRetryTask()` → uses `LoopContext` + `RetryOptions`

2. **`orchestration/task-handlers.ts`** (after spec 016)
   - Handler functions receive `LoopContext` instead of individual params

3. **`commands/init.ts`**
   - `initCommand()` options already good
   - Internal helpers like `createProjectFiles()` — consider if needed

## Tasks

- [ ] Define `LoopContext` interface in `src/orchestration/types.ts`
- [ ] Define `ExecuteAgentOptions` interface
- [ ] Define `RetryTaskOptions` interface
- [ ] Refactor `executeAgentWithPrompt()` to use options object
- [ ] Refactor `runSingleTask()` to use `LoopContext`
- [ ] Refactor `runRetryTask()` to use `LoopContext` + `RetryOptions`
- [ ] Refactor `handleBlockedTask()` to use `LoopContext`
- [ ] Refactor `handleGatesPassed()` to use `LoopContext`
- [ ] Refactor `handleGatesFailed()` to use `LoopContext`
- [ ] Refactor `handleTaskError()` to use `LoopContext`
- [ ] Refactor `handleDoneResult()` to use `LoopContext`
- [ ] Update `runTaskLevelLoop()` to create and pass `LoopContext`
- [ ] Update all call sites
- [ ] Run tests to verify no regressions

## Acceptance Criteria

- [ ] Given any function in `orchestration/`, when it has more than 3 parameters, then it uses an options object
- [ ] Given I read a function call like `runRetryTask(...)`, when I see the call, then I can understand each argument without looking up the definition
- [ ] Given I use VSCode/IDE, when I type `runRetryTask({`, then autocomplete shows me all available options with types
- [ ] Given I run `bun test`, when tests complete, then all tests pass
- [ ] Given I run `bun run typecheck`, when it completes, then there are no type errors

## Success Metrics

- No function has more than 3 positional parameters
- All orchestration functions share `LoopContext` for common dependencies
- Call sites are self-documenting (named arguments visible)

## Testing Requirements

- [ ] Existing tests must pass without modification
- [ ] No new tests needed (refactor preserves behavior)
- [ ] TypeScript compiler catches any missed call sites

## Notes

### Interface Definitions (Reference)

```typescript
// src/orchestration/types.ts

export interface LoopContext {
  projectPath: string;
  config: RalphConfig;
  session: RalphSession;
  agent: BaseAgent;
  log: (msg: string) => void;
  verbose?: boolean;
}

export interface ExecuteAgentOptions {
  prompt: string;
  onSpawn?: (child: ChildProcess) => void;
}

export interface RetryOptions {
  spec: SpecEntry;
  task: TaskEntry;
  failedGates: QualityGateResult[];
  retryCount: number;
}
```

### Call Site Example

```typescript
// Before (hard to read)
const result = await runRetryTask(
  projectPath,
  spec,
  task,
  failedGates,
  retryCount,
  agentInstance,
  session,
  log,
  verbose,
  setCurrentChild
);

// After (reads like prose)
const result = await runRetryTask(ctx, {
  spec,
  task,
  failedGates,
  retryCount,
});
```
