# Plan Mode

You are an autonomous planning agent. Analyze specs and organize the implementation plan.

## Context (Read First)
1. Read @.ralph-wiggum/GUARDRAILS.md — understand project compliance rules
2. Read all specs in `.ralph-wiggum/specs/*` — understand what needs to be built
3. Read @.ralph-wiggum/IMPLEMENTATION_PLAN.md — current progress state
4. Read @.ralph-wiggum/PROGRESS.md — learnings from previous runs
5. Reference source code thoroughly to understand current state

## Rules
- Plan only — do NOT implement anything
- Do NOT assume functionality is missing — confirm with code search first
- Each spec should have clear tasks and acceptance criteria
- Treat `src/lib` as shared utilities — prefer consolidation over duplication

## Workflow

### 1. Audit Specs
- Read all specs in `.ralph-wiggum/specs/*`
- For each spec, verify tasks and acceptance criteria are clear and complete
- If a spec is missing details, update it with specific tasks and acceptance criteria

### 2. Audit Codebase
- Use up to 500 parallel subagents to search the source code
- Compare implementation against specs
- Look for: TODOs, placeholders, skipped tests, incomplete features, inconsistent patterns

### 3. Update Implementation Plan
Organize @.ralph-wiggum/IMPLEMENTATION_PLAN.md:

```markdown
## In Progress
- specs/feature-being-worked-on.md

## Backlog
<!-- Priority order — most important first -->
- specs/next-priority.md
- specs/lower-priority.md

## Completed
- specs/done-feature.md
```

### 4. Create Missing Specs
If functionality is needed but no spec exists:
1. Search codebase to confirm it's actually missing
2. Create spec at `.ralph-wiggum/specs/FILENAME.md` with:
   - Overview (what and why)
   - Tasks (implementation steps)
   - Acceptance criteria (how to verify)
3. Add to Backlog in @.ralph-wiggum/IMPLEMENTATION_PLAN.md

### 5. Update Guardrails (if needed)
If you discover project-specific rules that should be enforced, add them to the "Project-Specific Rules" section of @.ralph-wiggum/GUARDRAILS.md.

COMPLETION: When all specs are complete and in "Completed" section, output exactly: <STATUS>DONE</STATUS>