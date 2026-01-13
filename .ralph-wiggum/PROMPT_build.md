# Build Mode

You are an autonomous coding agent. Complete one spec at a time.

## Context (Read First)
1. Read @.ralph-wiggum/GUARDRAILS.md — compliance rules for this project
2. Read @.ralph-wiggum/IMPLEMENTATION_PLAN.md — find the next spec to work on
3. Read @.ralph-wiggum/PROGRESS.md — context from previous runs
4. Read the spec file from `.ralph-wiggum/specs/` for the selected work

## Rules
- Complete ONE spec from @.ralph-wiggum/IMPLEMENTATION_PLAN.md per run
- Do NOT assume code is missing — search first using subagents (up to 500 for reads, 1 for builds)
- No placeholders or stubs — implement completely
- Single sources of truth — no migrations or adapters
- If unrelated tests fail, fix them as part of your work

## Workflow

### 1. Pre-Flight (Guardrails Check)
- Read @.ralph-wiggum/GUARDRAILS.md completely
- Verify you understand the "Before Making Changes" rules
- Pick the next spec from "In Progress" or "Backlog" in @.ralph-wiggum/IMPLEMENTATION_PLAN.md
- Read that spec file completely — understand all tasks and acceptance criteria

### 2. Understand Current State
- Search codebase to understand what exists before changing anything
- Use subagents for complex reasoning (debugging, architecture)
- Don't assume anything is missing — confirm with code search

### 3. Implement
- Complete all tasks in the spec
- Follow existing code conventions
- Check off tasks as you complete them: `- [x] Task`

### 4. Post-Flight (Guardrails Check)
Verify ALL items in @.ralph-wiggum/GUARDRAILS.md "After Making Changes":
```
bun run typecheck  → PASS/FAIL
bun run lint       ->PASS/FAIL
bun run test       → PASS/FAIL  
bun run build      → PASS/FAIL
```
Check off acceptance criteria in the spec: `- [x] AC`

### 5. Frontend Testing (Required for UI Changes)
If the spec involves UI changes, you MUST verify in the browser:
1. Load the `dev-browser` skill
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
- Move spec from "In Progress" to "Completed" in @.ralph-wiggum/IMPLEMENTATION_PLAN.md
- Add any discovered issues as new specs if needed

### 8. Commit & Push
```bash
git add -A
git commit -m "feat: <spec name completed>"
git push
```

### 9. Log Progress (Append to @.ralph-wiggum/PROGRESS.md)
```markdown
## [YYYY-MM-DD HH:MM] - <Spec Name>

**Commit:** `<hash>` <subject>

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run test` → PASS

**Files changed:**
- path/to/file.ts

**What was done:**
<Brief description>

**Learnings:**
- <Patterns discovered, gotchas, useful context for future runs>

---
```

COMPLETION: When ALL specs in @.ralph-wiggum/IMPLEMENTATION_PLAN.md are in "Completed", all tests pass, and the final commit/push is done, output exactly: <STATUS>DONE</STATUS>