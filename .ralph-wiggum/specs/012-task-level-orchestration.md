# Task-Level Orchestration

## Problem to solve

As a Ralph user, I want the build mode to work on one task at a time (instead of one spec at a time), so I can get better quality output with smaller LLM context windows and deterministic quality gates.

## Intended users

- Developers using Ralph CLI to automate feature implementation
- Teams with complex specs containing multiple tasks

## User experience goal

The user should be able to run `ralph start build` and have Ralph automatically:

1. Pick the next pending task from `implementation.json`
2. Generate a focused prompt for just that task
3. Run the agent with bounded scope
4. Execute quality gates externally (not relying on agent)
5. Retry with failure context if gates fail
6. Mark task complete and move to next

## Proposal

### 1. Replace `IMPLEMENTATION_PLAN.md` + `tasks.json` with single `implementation.json`

Plan mode extracts structured data from specs and writes to `implementation.json`:

```json
{
  "version": 1,
  "updatedAt": "2026-01-17T10:30:00Z",
  "updatedBy": "plan-mode",
  "specs": [
    {
      "id": "user-avatar-upload",
      "file": "specs/user-avatar-upload.md",
      "name": "User Avatar Upload",
      "priority": 1,
      "status": "in_progress",
      "context": "Allow users to upload avatars. Use S3 client in src/lib/aws.ts.",
      "tasks": [
        {
          "id": "user-avatar-upload-1",
          "description": "Add avatarUrl field to User schema",
          "status": "completed"
        },
        {
          "id": "user-avatar-upload-2",
          "description": "Create S3 upload endpoint",
          "status": "pending",
          "acceptanceCriteria": ["Users can upload JPG/PNG up to 5MB"]
        }
      ],
      "acceptanceCriteria": ["Users can upload JPG/PNG up to 5MB"]
    }
  ]
}
```

### 2. Update Plan mode prompt to output `implementation.json`

Plan mode becomes the "LLM pre-parser" that:

- Reads freeform markdown specs
- Extracts structured tasks and acceptance criteria
- Assigns priority order
- Writes deterministic JSON for build mode

### 3. Build mode reads JSON and orchestrates tasks

```
For each spec (by priority):
  For each task (where status === 'pending'):
    1. Generate task-specific prompt (inject task + context)
    2. Spawn agent
    3. Wait for <TASK_DONE> or <TASK_BLOCKED>
    4. Run quality gates (typecheck, lint, test, build)
    5. If gates fail && retries < max: inject failure, retry
    6. If gates pass: mark task complete in implementation.json
  When all tasks complete:
    - Mark spec complete
    - Commit with spec name
    - Append to PROGRESS.md
```

### 4. Task prompt template

```markdown
# Task: {task.description}

## Spec Context

You are working on: **{spec.name}**
{spec.context}

## Completed Tasks

{completedTasks.map(t => `- [x] ${t.description}`)}

## Your Assignment

Complete ONLY this task:

> {task.description}

## Acceptance Criteria

{task.acceptanceCriteria.map(ac => `- [ ] ${ac}`)}

## Rules

- Do NOT work on other tasks
- Do NOT commit (Ralph handles commits)
- Search codebase first — don't assume code is missing

## Completion

When done, output exactly: <TASK_DONE>
If blocked, output: <TASK_BLOCKED reason="...">
```

### 5. Quality gates run externally by Ralph

```typescript
const gates = [
  { name: "typecheck", command: "bun run typecheck", required: true },
  { name: "lint", command: "bun run lint", required: false },
  { name: "test", command: "bun run test", required: true },
  { name: "build", command: "bun run build", required: true },
];
```

### 6. Failure injection for retries

If gates fail, generate retry prompt with failure output injected.

## Tasks

- [ ] Add TypeScript types for `Implementation`, `SpecEntry`, `TaskEntry`
- [ ] Create `implementation.json` template and path utilities
- [ ] Update Plan mode prompt to output `implementation.json`
- [ ] Add `parseImplementation()` and `saveImplementation()` functions
- [ ] Create `generateTaskPrompt()` function for dynamic prompts
- [ ] Create `generateRetryPrompt()` function for failure injection
- [ ] Implement external quality gate runner
- [ ] Refactor `start.ts` build mode to use task-level loop
- [ ] Update init command to create `implementation.json` instead of `IMPLEMENTATION_PLAN.md`
- [ ] Add task completion markers (`<TASK_DONE>`, `<TASK_BLOCKED>`)
- [ ] Handle `<TASK_BLOCKED>` by marking task as blocked with reason

## Acceptance Criteria

- [ ] Given a spec with 3 tasks, when running build mode, then Ralph spawns 3 separate agent sessions (one per task)
- [ ] Given a task completes successfully, when quality gates pass, then task status updates to "completed" in implementation.json
- [ ] Given quality gates fail after a task, when retry count < max, then Ralph spawns new agent with failure context injected
- [ ] Given all tasks in a spec complete, when build mode continues, then Ralph commits with spec name and moves to next spec
- [ ] Given plan mode runs, when specs exist, then implementation.json is created with extracted tasks
- [ ] Given implementation.json exists, when build mode starts, then Ralph reads it without LLM parsing

## Success Metrics

- Build mode context size reduced (one task vs entire spec)
- Quality gate pass rate increases (external enforcement vs agent self-check)
- Failed tasks get automatic retry with specific failure context

## Testing Requirements

- [ ] Unit tests for `parseImplementation()`, `saveImplementation()`
- [ ] Unit tests for `generateTaskPrompt()`, `generateRetryPrompt()`
- [ ] Unit tests for quality gate runner
- [ ] Integration test for task-level build loop
- [ ] Update existing e2e tests
- [ ] Update existing unit tests

## Notes

- `IMPLEMENTATION_PLAN.md` will be removed (replaced by `implementation.json`)
- Specs remain as markdown for human authoring
- `PROGRESS.md` remains as markdown for audit trail
