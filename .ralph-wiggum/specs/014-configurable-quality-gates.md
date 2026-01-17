# Configurable Quality Gates

## Problem to solve
As a developer using Ralph CLI, I want to define project-specific quality gates in `implementation.json`, so my team shares the same build verification commands without relying on gitignored config files.

## Intended users
- Developers using Ralph CLI for autonomous coding loops
- Teams wanting consistent quality checks across contributors

## User experience goal
The user should be able to define custom quality gate commands in `implementation.json` that are version-controlled and automatically used during build mode task verification.

## Proposal
Add a `qualityGates` array to the root of `implementation.json`:

```json
{
  "qualityGates": [
    "bun run typecheck",
    "bun run test",
    "bun run build"
  ],
  "specs": [...]
}
```

- If `qualityGates` is not defined or empty, no quality gates are run
- All gates in the array are treated as required (fail = task fails)
- Gate name is derived from the command (e.g., "typecheck" from "bun run typecheck")
- The `implementation.json` template created during `ralph init` includes commented sample gates

## Tasks
- [ ] Update `Implementation` interface in `src/types.ts` to include optional `qualityGates?: string[]`
- [ ] Create `parseQualityGates(commands: string[]): QualityGate[]` utility in `src/utils/quality-gates.ts`
- [ ] Update build mode to read gates from implementation.json (skip if not defined)
- [ ] Update `createEmptyImplementation()` in `src/utils/implementation.ts` to include sample `qualityGates` array
- [ ] Remove or deprecate `DEFAULT_QUALITY_GATES` constant
- [ ] Add unit tests for `parseQualityGates`

## Acceptance Criteria
- [ ] Given `implementation.json` has `qualityGates` array, when build mode runs, then those commands are used for verification
- [ ] Given `implementation.json` has no `qualityGates` key, when build mode runs, then quality gate verification is skipped
- [ ] Given a quality gate command fails, when verifying a task, then the task is marked as failed
- [ ] Given `ralph init` is run, when `implementation.json` is created, then it contains sample `qualityGates` array via `createEmptyImplementation()`

## Success Metrics
- Teams can customize quality gates without modifying source code
- Quality gate configuration is shared via git

## Testing Requirements
- [ ] Unit test: `parseQualityGates` converts string array to `QualityGate[]`
- [ ] Unit test: Empty array results in no gates being run
- [ ] Integration: Build mode uses custom gates from implementation.json

## Notes
- Gate name extraction: last word of command (e.g., "npm run lint" → "lint", "bun test" → "test")
- All user-defined gates are `required: true` by default (simplifies config)
- No hardcoded defaults - runtime agnostic (works with bun, npm, pnpm, yarn, etc.)
- Template includes sample gates (user should adjust for their runtime/scripts)
- Future enhancement: support object format for optional gates `{ command: "...", required: false }`
