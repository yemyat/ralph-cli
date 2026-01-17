# Task-Level Build Loop Integration Test

## Problem to solve

As a Ralph developer, I want an integration test for the task-level build loop, so I can verify two critical behaviors:
1. **Task isolation**: Agent receives only ONE task at a time, not the entire spec
2. **Retry with context**: Failed tasks get retried with specific failure output injected

## Intended users

- Ralph CLI developers
- CI/CD pipelines

## User experience goal

The developer should be able to run the test suite and have confidence that:
1. Each agent session receives a prompt scoped to a single task
2. Failed quality gates trigger retry with failure context in the prompt
3. Task/spec status updates correctly in `implementation.json`

## Proposal

Extend the existing mock agent pattern from `e2e-loop.test.ts`. The mock agent script will:
1. Capture the prompt it receives (write to temp file for assertion)
2. Output configurable responses (`<TASK_DONE>`, `<TASK_BLOCKED>`)
3. Simulate quality gate pass/fail scenarios

### Key assertions

1. **Task isolation**: Inspect captured prompts to verify each contains only ONE task description, not the full spec
2. **Retry context injection**: When quality gates fail, verify the retry prompt includes the failure output (e.g., "typecheck failed: ...")
3. **State transitions**: Verify `implementation.json` updates after each task

### Mock strategy

1. Mock agent script (like existing `MOCK_AGENT_SCRIPT`) that:
   - Writes received prompt to a temp file
   - Outputs `<TASK_DONE>` or `<TASK_BLOCKED>` based on env var
2. Mock quality gate runner via env var or script that returns configurable exit codes
3. Use temp directory with test `implementation.json` containing 3 tasks
4. After each spawn, read captured prompt and assert on content

## Tasks

- [ ] Create mock agent script that captures prompt to temp file
- [ ] Create mock quality gate script with configurable exit codes
- [ ] Write test: 3 tasks spawn 3 separate sessions with isolated prompts
- [ ] Write test: captured prompt contains ONLY current task, not other tasks
- [ ] Write test: quality gate failure triggers retry with failure output in prompt
- [ ] Write test: `implementation.json` task status updates to "completed" after success
- [ ] Write test: blocked task gets marked with reason from `<TASK_BLOCKED>`

## Acceptance Criteria

- [ ] Given a spec with 3 tasks, when build loop runs, then 3 separate agent sessions are spawned
- [ ] Given task 2 of 3, when agent is spawned, then prompt contains ONLY task 2 description (not task 1 or 3)
- [ ] Given quality gates fail with "typecheck: error TS123", when retry spawns, then prompt includes "typecheck: error TS123"
- [ ] Given all 3 tasks complete successfully, when build loop finishes, then all 3 tasks show status "completed" in implementation.json
- [ ] Given agent outputs `<TASK_BLOCKED reason="missing API key">`, when build loop processes, then task status is "blocked" with blockedReason "missing API key"

## Success Metrics

- Test proves task isolation (agent never sees full spec, only current task)
- Test proves retry includes failure context
- CI passes with mocked agent tests (no real AI calls)

## Testing Requirements

- [ ] Integration tests using Bun test runner
- [ ] Tests run without network/AI dependencies
- [ ] Tests follow pattern from existing `e2e-loop.test.ts`

## Notes

- Extend existing `MOCK_AGENT_SCRIPT` pattern - spawn real process, mock behavior
- Key insight: capture prompt to temp file so we can assert on its contents
- Quality gates can be mocked via env var that controls exit code
