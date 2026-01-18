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
      "file": ".ralph-wiggum/specs/spec-file.md",
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
- Make sure to copy / paste relevant acceptance criteria from the spec file for each task. Some tasks may share the same acceptance criteria.

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

export const PROMPT_BUILD = `# Build Mode

## Context (Read First)

You are working on a specific task that is mentioned below. The task is part of a large spec. You have been iterating step by step on tasks from within that spec.

### Larger Spec Context
{{spec_name}}

You can find the full specs in the file: {{full_specs_file}} (This is under ".ralph-wiggum" folder. You'll find ".ralph-wiggum/specs")

### Task Description
{{task_context}}

- Read \`.ralph-wiggum/PROGRESS.md\` — context from previous runs
- Read @.ralph-wiggum/GUARDRAILS.md for compliance rules.

## Rules
- Do NOT assume code is missing — search first using subagents (up to 500 for reads, 1 for builds)
- No placeholders or stubs — implement completely
- Single sources of truth — no migrations or adapters
- If unrelated tests fail, fix them as part of your work

## Workflow

### 1. Pre-Flight (Guardrails Check)
- Read \`.ralph-wiggum/GUARDRAILS.md\` completely
- Verify you understand the "Before Making Changes" rules
- Create an implementation plan around the task according to the following acceptance criteria
<acceptanceCriteria>
{{acceptance_criteria}}
</acceptanceCriteria>

### 2. Understand Current State
- Search codebase before making changes
- Use subagents for complex reasoning if needed
- Don't assume anything is missing — confirm with code search

### 3. Implement
- Complete the assigned task only
- Follow existing code conventions
- Make all changes needed for the task to pass its acceptance criteria mentioned earlier

### 4. Post-Flight (Guardrails Check)
- Verify ALL items in \`.ralph-wiggum/GUARDRAILS.md\` "After Making Changes":
- Check off acceptance criteria in the spec: \`- [x] AC\`

### 5. Frontend Testing (Required for UI Changes)
If the spec involves UI changes, you MUST verify in the browser:
1. Load the \`agent-browser\` skill
2. Navigate to the relevant page
3. Verify the UI works as expected
4. Take a screenshot for the progress log

A frontend spec is NOT complete until browser verification passes.

### 6. Backend Testing (Required for API/Service Changes)
If the spec involves backend changes, you MUST run all relevant tests:
1. Unit tests — test individual functions/modules in isolation
2. Integration tests — test interactions between components
3. E2E tests — test complete workflows end-to-end

Adjust commands based on project (check package.json or AGENTS.md for available test scripts).

A backend spec is NOT complete until all relevant test suites pass.

### 7. Update Plan
- Move spec from "In Progress" to "Completed" in \`.ralph-wiggum/implementation.json\`
- Check off the task in the spec: \`- [x] AC\`
- Add any discovered issues as new specs if needed

### 8. Commit & Push
\`\`\`bash
git add -A
git commit -m "feat: <spec name completed>"
git push
\`\`\`

### 9. Log Progress (Append to \`.ralph-wiggum/PROGRESS.md\`). Example below:
\`\`\`markdown
## [YYYY-MM-DD HH:MM] - <Spec Name>

**Commit:** \`<hash>\` <subject>

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

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

### 10. Signal Completion

When the task is done, output exactly:
\`\`\`
<TASK_DONE>
\`\`\`

If blocked (dependency missing, unclear requirement, etc.), output:
\`\`\`
<TASK_BLOCKED reason="Describe why you're blocked">
\`\`\`

COMPLETION: When ALL specs in \`.ralph-wiggum/implementation.json\` are in "Completed", all tests pass, and the final commit/push is done, output exactly: <STATUS>DONE</STATUS>`;

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
