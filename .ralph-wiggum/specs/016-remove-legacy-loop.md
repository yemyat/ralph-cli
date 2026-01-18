# Remove Legacy Loop & Simplify Orchestration

## Problem to solve

As a maintainer, I want to remove the legacy spec-level loop code, so I can reduce cognitive load when reading `start.ts` and eliminate dead code paths that confuse new contributors.

Currently, `start.ts` is 838 lines with two parallel orchestration systems:
1. Legacy `runRalphLoop()` — spec-level, uses `PROMPT_build.md` file
2. Current `runTaskLevelLoop()` — task-level, uses `implementation.json`

The legacy loop is no longer used but accounts for ~150 lines of code and introduces branching logic that obscures the main flow.

## Intended users

- Maintainers reading/modifying orchestration code
- Contributors adding new features to the build loop
- Future self trying to understand "what does start.ts do?"

## User experience goal

A developer should be able to open `start.ts`, read top-to-bottom, and understand the build loop in under 5 minutes without encountering dead code paths or "which loop am I in?" confusion.

## Proposal

### Phase 1: Remove Legacy Loop

1. Delete `runRalphLoop()` function entirely
2. Delete `DONE_MARKER` constant (only used by legacy loop)
3. Remove the `useTaskLevel` branching logic in `startCommand()`
4. Remove `PROMPT_build.md` template from `prompts.ts` (keep `PROMPT_BUILD` constant for task prompts)
5. Update `init.ts` to not create `PROMPT_build.md` file

### Phase 2: Extract Orchestration Module

Split `start.ts` into focused modules:

```
src/
├── commands/
│   └── start.ts              # CLI entry point only (~100 lines)
├── orchestration/
│   ├── task-loop.ts          # runTaskLevelLoop (~200 lines)
│   ├── task-handlers.ts      # handleBlockedTask, handleGatesPassed, etc.
│   ├── agent-executor.ts     # executeAgentWithPrompt, runSingleTask
│   └── notifications.ts      # notifyTelegram, getGitBranch
```

### Phase 3: Simplify startCommand()

After extraction, `startCommand()` becomes a thin orchestrator:

```typescript
export async function startCommand(mode: "plan" | "build", options: StartOptions): Promise<void> {
  const context = await validateAndPrepare(projectPath, mode, options);
  if (!context) return;
  
  if (mode === "plan") {
    await runPlanMode(context);
  } else {
    await runTaskLoop(context);
  }
}
```

## Tasks

- [ ] Delete `runRalphLoop()` function from `start.ts`
- [ ] Delete `DONE_MARKER` constant
- [ ] Remove `useTaskLevel` conditional and legacy prompt file check
- [ ] Delete `PROMPT_BUILD_LEGACY` template if it exists (verify `PROMPT_build.md` vs `PROMPT_BUILD`)
- [ ] Update `init.ts` to remove `PROMPT_build.md` file creation
- [ ] Update `reinit.ts` if it touches `PROMPT_build.md`
- [ ] Create `src/orchestration/` directory
- [ ] Extract `runTaskLevelLoop()` to `orchestration/task-loop.ts`
- [ ] Extract handler functions to `orchestration/task-handlers.ts`
- [ ] Extract `executeAgentWithPrompt`, `runSingleTask`, `runRetryTask` to `orchestration/agent-executor.ts`
- [ ] Extract `notifyTelegram`, `getGitBranch` to `orchestration/notifications.ts`
- [ ] Update imports in `start.ts` to use new modules
- [ ] Verify all existing tests still pass

## Acceptance Criteria

- [ ] Given I run `ralph-wiggum-cli start build`, when there are tasks in `implementation.json`, then the task-level loop executes (no behavior change)
- [ ] Given I search for `runRalphLoop` in the codebase, when I search, then zero results are found
- [ ] Given I search for `DONE_MARKER` in the codebase, when I search, then zero results are found
- [ ] Given I open `commands/start.ts`, when I read it, then it is under 150 lines
- [ ] Given I open `orchestration/task-loop.ts`, when I read it, then it only contains loop orchestration logic
- [ ] Given I run `bun test`, when tests complete, then all 211 tests still pass

## Success Metrics

- `start.ts` reduced from 838 lines to <150 lines
- No single file in `orchestration/` exceeds 250 lines
- Zero dead code paths (no unreachable branches)
- Test suite passes without modification (behavior unchanged)

## Testing Requirements

- [ ] Existing integration tests in `task-level-loop.test.ts` must pass unchanged
- [ ] Existing e2e tests in `e2e-loop.test.ts` must pass unchanged
- [ ] No new tests required (this is a refactor, not new behavior)

## Notes

- The legacy loop used `PROMPT_build.md` which was read from disk
- The task loop uses `PROMPT_BUILD` constant embedded in task prompts
- Keep `PROMPT_BUILD` in `templates/prompts.ts` — it's used by `generateTaskPrompt()`
- Plan mode still uses `PROMPT_plan.md` file — don't touch that flow
