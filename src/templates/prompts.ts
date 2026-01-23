export const PROMPT_PLAN = `# Plan Mode

Create implementation plans from specs by thoroughly exploring the codebase first. Use sub-agents as "exploration tracers" to discover all potential change locations before breaking work into tasks.

## Philosophy

**The problem with naive planning**: Specs describe WHAT to build, but implementation plans need to describe WHAT TO CHANGE. The gap between these is where agents fail—they burn context discovering change locations instead of implementing.

**Solution**: Do expensive exploration ONCE during planning, so execution agents work from concrete checklists.

## Context (Read First)
1. Read \`.ralph-wiggum/GUARDRAILS.md\` — project compliance rules
2. The spec file being planned
3. \`.ralph-wiggum/implementation.json\` — current progress (use \`jq\` to query)

## Process

### Phase 1: Parse Spec

Read the spec file and extract:
- Requirements (what needs to change)
- Acceptance criteria (how to verify)
- Mentioned files/modules (hints for exploration)
- Dependencies on other specs

### Phase 2: Identify Exploration Targets

From each requirement, derive exploration questions:
- "Where is X defined?"
- "What files use Y?"
- "What tests cover Z?"
- "What patterns exist for similar functionality?"

### Phase 3: Spawn Exploration Sub-Agents (Parallel)

For each major exploration target, spawn a sub-agent.

\`\`\`
Example for "Remove transactionIds from artifacts":

Agent A: "Find all definitions and usages of transactionIds in artifacts"
  → Returns: schema.ts:42, types.ts:89, queries.ts:67/120, mutations.ts:30

Agent B: "Find all tests that reference artifact transactionIds"
  → Returns: artifacts.test.ts:200/340, scrapbook.test.ts:89

Agent C: "Trace what depends on artifact.transactionIds for data"
  → Returns: scrapbook.ts:89 uses it for timeline, nowhere else
\`\`\`

Each sub-agent should return:
- File paths with line numbers
- Patterns observed (e.g., "uses compound index", "has auth check")
- Estimated lines of code to change
- Any concerns or complexity notes

**No arbitrary cap on sub-agents**—use as many as needed for thorough exploration.

### Phase 4: Synthesize Into Tasks

Group exploration findings into tasks using these heuristics:

| Signal | Action |
|--------|--------|
| Same file, routine changes (< 30 LOC) | Merge into one task |
| Different files, same pattern | Merge if total LOC < 50 |
| Creates something others depend on | Separate task (first in chain) |
| Complex logic requiring reasoning | Separate task |
| Natural verification boundary | Separate task |
| Tests for a feature | Include with feature if small, separate if > 30 LOC |

**LOC → Points guidance** (use internally, don't store LOC):
- 1-20 LOC routine changes → 1-2 points
- 20-50 LOC or moderate complexity → 3 points
- 50-100 LOC or high complexity → 5 points
- > 100 LOC → must split into multiple tasks

### Phase 5: Output implementation.json

Update \`.ralph-wiggum/implementation.json\` with the new task structure:

\`\`\`json
{
  "version": 1,
  "updatedAt": "2026-01-23T10:30:00Z",
  "updatedBy": "plan-mode",
  "specs": [
    {
      "id": "060-feat-something",
      "file": ".ralph-wiggum/specs/060-feat-something.md",
      "name": "Human Readable Name",
      "priority": 160,
      "status": "pending",
      "dependsOn": [],
      "pointsBudget": 15,
      "tasks": [
        {
          "id": "060-feat-something-1",
          "description": "Schema + type changes for new feature",
          "potentialChangeLocations": [
            "convex/schema.ts:142 - add newField to someTable",
            "convex/schema.ts:156 - add by_userId_newField index",
            "convex/types.ts:89 - update SomeTableDoc type",
            "convex/validators.ts:34 - may need validator update"
          ],
          "points": 2,
          "status": "pending",
          "acceptanceCriteria": [
            "newField exists in schema with correct type",
            "Index by_userId_newField exists",
            "bun run typecheck passes"
          ]
        },
        {
          "id": "060-feat-something-2",
          "description": "Core queries and mutations for new feature",
          "potentialChangeLocations": [
            "convex/core/someTable/queries.ts:45 - add getByNewField query",
            "convex/core/someTable/mutations.ts:67 - update create to accept newField",
            "convex/core/someTable/internal.ts:23 - add helper for newField lookup"
          ],
          "points": 3,
          "status": "pending",
          "dependsOn": ["060-feat-something-1"],
          "acceptanceCriteria": [
            "getByNewField query works with auth check",
            "create mutation accepts and persists newField",
            "bun run typecheck passes"
          ]
        }
      ],
      "acceptanceCriteria": ["Spec-level AC copied from spec file"]
    }
  ]
}
\`\`\`

## Task Schema

Each task MUST have:
- \`id\`: \`{spec-id}-{number}\` format
- \`description\`: What to do (action-oriented)
- \`potentialChangeLocations\`: Array of \`"file:line - what to change"\` strings
- \`points\`: 1, 2, 3, or 5 (never 8—split instead)
- \`status\`: "pending"
- \`acceptanceCriteria\`: How to verify completion

Optional:
- \`dependsOn\`: Task IDs that must complete first

## Rules

1. **Plan only** — do NOT implement anything
2. **Explore thoroughly** — use sub-agents liberally to trace all usages
3. **Be concrete** — \`potentialChangeLocations\` should have file:line where possible
4. **Estimate with LOC** — points should reflect actual code volume discovered during exploration
5. **Merge small changes** — don't create tasks for < 15 LOC unless there's a hard dependency
6. **Split large changes** — no task should exceed ~100 LOC or 5 points

## Example Sub-Agent Prompts

**For tracing usages:**
\`\`\`
Find all usages of \`transactionIds\` field on artifacts table.
Return: file paths with line numbers, whether it's a read or write,
and any patterns you observe (e.g., always used with userId filter).
\`\`\`

**For tracing dependencies:**
\`\`\`
What code depends on the return value of \`getArtifactById\`?
Trace callers and report what fields they access.
\`\`\`

**For finding tests:**
\`\`\`
Find all tests that would need updating if we remove \`transactionIds\` from artifacts.
Return: test file paths, line numbers, and what the test is asserting.
\`\`\`

**For pattern discovery:**
\`\`\`
How do existing core modules (e.g., core/transactions, core/users) structure
their queries.ts and mutations.ts? Report the patterns so we can follow them.
\`\`\`

COMPLETION: When the spec has been fully explored and tasks created, output exactly: <STATUS>DONE</STATUS>`;

export const PROMPT_BUILD = `# Build Mode

## Context (Read First)

You are working on a specific task that is mentioned below. The task is part of a larger spec. You have been iterating step by step on tasks from within that spec.

### Spec Context
**Spec:** {{spec_name}}
**Spec File:** {{full_specs_file}}

### Task
**Description:** {{task_description}}
**Points:** {{task_points}}
{{#task_depends_on}}
**Depends On:** {{task_depends_on}}
{{/task_depends_on}}

### Potential Change Locations
These locations were identified during planning—use them as your starting points:
{{potential_change_locations}}

### Acceptance Criteria
{{acceptance_criteria}}

- Read \`.ralph-wiggum/PROGRESS.md\` — context and learnings from previous runs
- Read \`.ralph-wiggum/GUARDRAILS.md\` for compliance rules.

## Rules
- Start with the potential change locations above—they were discovered during planning
- Do NOT assume code is missing — search first using subagents
- No placeholders or stubs — implement completely
- Single sources of truth — no migrations or adapters
- If unrelated tests fail, fix them as part of your work

## Workflow

### 1. Pre-Flight (Guardrails Check)
- Read \`.ralph-wiggum/GUARDRAILS.md\` completely
- Verify you understand the "Before Making Changes" rules
- Review the potential change locations and acceptance criteria above

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
