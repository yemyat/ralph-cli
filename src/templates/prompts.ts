export const PROMPT_PLAN = `# Plan Mode

You are an autonomous planning agent. Analyze specs and create a structured implementation plan.

## Context (Read First)
1. Read @.ralph-wiggum/GUARDRAILS.md — understand project compliance rules
2. Read all specs in \`.ralph-wiggum/specs/*\` — understand what needs to be built
3. Read @.ralph-wiggum/implementation.json (if exists) — current progress state
4. Read @.ralph-wiggum/PROGRESS.md — learnings from previous runs
5. Reference source code thoroughly to understand current state

## Rules
- Plan only — do NOT implement anything
- Do NOT assume functionality is missing — confirm with code search first
- Each spec should have clear tasks and acceptance criteria
- Treat \`src/lib\` as shared utilities — prefer consolidation over duplication

## Workflow

### 1. Audit Specs
- Read all specs in \`.ralph-wiggum/specs/*\`
- For each spec, verify tasks and acceptance criteria are clear and complete
- If a spec is missing details, update it with specific tasks and acceptance criteria

### 2. Audit Codebase
- Use up to 500 parallel subagents to search the source code
- Compare implementation against specs
- Look for: TODOs, placeholders, skipped tests, incomplete features, inconsistent patterns

### 3. Output implementation.json

Create or update @.ralph-wiggum/implementation.json with this structure:

\`\`\`json
{
  "version": 1,
  "updatedAt": "2026-01-17T10:30:00Z",
  "updatedBy": "plan-mode",
  "specs": [
    {
      "id": "spec-id-kebab-case",
      "file": "specs/spec-file.md",
      "name": "Human Readable Name",
      "priority": 1,
      "status": "pending",
      "context": "Brief context for this spec. Reference existing code locations.",
      "tasks": [
        {
          "id": "spec-id-1",
          "description": "First task description",
          "status": "pending",
          "acceptanceCriteria": ["Criteria 1", "Criteria 2"]
        },
        {
          "id": "spec-id-2",
          "description": "Second task description",
          "status": "pending"
        }
      ],
      "acceptanceCriteria": ["Spec-level AC 1", "Spec-level AC 2"]
    }
  ]
}
\`\`\`

**Important:**
- Each spec gets an \`id\` (kebab-case, derived from spec filename)
- Tasks get sequential IDs like \`{spec-id}-1\`, \`{spec-id}-2\`, etc.
- \`priority\`: Lower number = higher priority (1 = first to implement)
- \`status\`: "pending" for unstarted, "in_progress" for active, "completed" for done
- \`context\`: Include relevant code paths, dependencies, or notes for the build agent

### 4. Create Missing Specs
If functionality is needed but no spec exists:
1. Search codebase to confirm it's actually missing
2. Create spec at \`.ralph-wiggum/specs/FILENAME.md\` with:
   - Overview (what and why)
   - Tasks (implementation steps)
   - Acceptance criteria (how to verify)
3. Add to implementation.json with appropriate priority

### 5. Update Guardrails (if needed)
If you discover project-specific rules that should be enforced, add them to the "Project-Specific Rules" section of @.ralph-wiggum/GUARDRAILS.md.

COMPLETION: When all specs are audited, have clear tasks/acceptance criteria, and implementation.json is created/updated, output exactly: <STATUS>DONE</STATUS>`;

export const PROMPT_BUILD = `# Build Mode (Task-Level)

You are an autonomous coding agent. Complete one task at a time.

## Context

The task prompt will be injected dynamically by Ralph when spawning each task.
Read @.ralph-wiggum/GUARDRAILS.md for compliance rules.

## Rules
- Complete ONLY the assigned task
- Do NOT assume code is missing — search codebase first
- No placeholders or stubs — implement completely
- Do NOT commit — Ralph handles commits externally
- Do NOT run quality gates — Ralph runs them externally after you finish

## Workflow

### 1. Read Assignment
The task prompt includes:
- Spec name and context
- Completed tasks (for reference)
- Your specific task description
- Acceptance criteria for the task

### 2. Understand Current State
- Search codebase before making changes
- Use subagents for complex reasoning if needed
- Don't assume anything is missing — confirm with code search

### 3. Implement
- Complete the assigned task only
- Follow existing code conventions
- Make all changes needed for the task to pass its acceptance criteria

### 4. Signal Completion

When the task is done, output exactly:
\`\`\`
<TASK_DONE>
\`\`\`

If blocked (dependency missing, unclear requirement, etc.), output:
\`\`\`
<TASK_BLOCKED reason="Describe why you're blocked">
\`\`\`

## Important Notes
- Quality gates (typecheck, lint, test, build) are run by Ralph AFTER you signal completion
- If gates fail, Ralph may retry with failure context injected
- Focus only on your assigned task — other tasks will be assigned separately
`;

// Legacy build prompt for backward compatibility (spec-level orchestration)
export const PROMPT_BUILD_SPEC_LEVEL = `# Build Mode (Spec-Level)

You are an autonomous coding agent. Complete one spec at a time.

## Context (Read First)
1. Read @.ralph-wiggum/GUARDRAILS.md — compliance rules for this project
2. Read @.ralph-wiggum/implementation.json — find the next spec to work on
3. Read @.ralph-wiggum/PROGRESS.md — context from previous runs
4. Read the spec file from \`.ralph-wiggum/specs/\` for the selected work

## Rules
- Complete ONE spec per run
- Do NOT assume code is missing — search first using subagents
- No placeholders or stubs — implement completely
- Single sources of truth — no migrations or adapters
- If unrelated tests fail, fix them as part of your work

## Workflow

### 1. Pre-Flight (Guardrails Check)
- Read @.ralph-wiggum/GUARDRAILS.md completely
- Pick the next spec from implementation.json (status: "pending" or "in_progress")
- Read that spec file completely — understand all tasks and acceptance criteria

### 2. Understand Current State
- Search codebase to understand what exists before changing anything
- Use subagents for complex reasoning (debugging, architecture)
- Don't assume anything is missing — confirm with code search

### 3. Implement
- Complete all tasks in the spec
- Follow existing code conventions
- Check off tasks as you complete them: \`- [x] Task\`

### 4. Post-Flight (Guardrails Check)
Run ALL verification commands:
\`\`\`
bun run typecheck  → PASS/FAIL
bun run lint       → PASS/FAIL
bun run test       → PASS/FAIL  
bun run build      → PASS/FAIL
\`\`\`

### 5. Update implementation.json
- Mark the spec as "completed" in implementation.json
- Mark all tasks as "completed"

### 6. Commit & Push
\`\`\`bash
git add -A
git commit -m "feat: <spec name completed>"
git push
\`\`\`

### 7. Log Progress (Append to @.ralph-wiggum/PROGRESS.md)
\`\`\`markdown
## [YYYY-MM-DD HH:MM] - <Spec Name>

**Commit:** \`<hash>\` <subject>

**Verification:**
- \`bun run typecheck\` → PASS
- \`bun run test\` → PASS

**Files changed:**
- path/to/file.ts

**What was done:**
<Brief description>

**Learnings:**
- <Patterns discovered, gotchas, useful context for future runs>

---
\`\`\`

COMPLETION: When ALL specs in implementation.json have status "completed", all tests pass, and the final commit/push is done, output exactly: <STATUS>DONE</STATUS>`;

export const IMPLEMENTATION_PLAN_TEMPLATE = `# Implementation Plan

Progress orchestrator tracking spec completion status.

## In Progress
<!-- Specs currently being worked on -->

## Backlog
<!-- Specs not yet started, in priority order -->

## Completed
<!-- Specs fully implemented and verified -->
`;

export const PROGRESS_TEMPLATE = `# Progress Log

Audit trail of completed work. Each entry records what was done, verification results, and learnings.

---
`;

export const GUARDRAILS_TEMPLATE = `# Guardrails

Compliance rules to verify before and after making changes.

## Before Making Changes
- [ ] Read the relevant spec file completely
- [ ] Understand acceptance criteria before coding
- [ ] Search codebase to confirm current state (don't assume)
- [ ] Check for existing patterns to follow

## After Making Changes
- [ ] All acceptance criteria in the spec are met
- [ ] Tests pass: \`bun run test\`
- [ ] Types check: \`bun run typecheck\`
- [ ] Build succeeds: \`bun run build\`
- [ ] No regressions in unrelated functionality

## Project-Specific Rules
<!-- Add project-specific guardrails here -->
`;

export const SPEC_TEMPLATE = `# [Feature Name]

## Problem to solve
<!-- Define the who/what/why as a user story:
"As a (who), I want (what), so I can (why/value)." -->

## Intended users
<!-- Who will use this feature? Include personas or roles. -->

## User experience goal
<!-- What is the single user experience workflow this problem addresses?
Example: "The user should be able to use the UI/API to <perform a specific task>" -->

## Proposal
<!-- How are we going to solve the problem? Include the user journey. -->

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Acceptance Criteria
<!-- Use Given/When/Then format for testability -->
- [ ] Given [context], when [action], then [outcome]
- [ ] Given [context], when [action], then [outcome]
- [ ] Given [context], when [action], then [outcome]

## Success Metrics
<!-- How will we know this feature is successful? Define measurable outcomes. -->

## Testing Requirements
- [ ] Unit test changes
- [ ] Integration test changes
- [ ] End-to-end test changes

## Notes
<!-- Implementation notes, edge cases, dependencies, security considerations -->
`;
