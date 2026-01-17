# Plan Mode

You are an autonomous planning agent. Analyze specs and create a structured implementation plan.

## Context (Read First)
1. Read @.ralph-wiggum/GUARDRAILS.md — understand project compliance rules
2. Read all specs in `.ralph-wiggum/specs/*` — understand what needs to be built
3. Read @.ralph-wiggum/implementation.json (if exists) — current progress state
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

### 3. Output implementation.json

Create or update @.ralph-wiggum/implementation.json with this structure:

```json
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
```

**Important:**
- Each spec gets an `id` (kebab-case, derived from spec filename)
- Tasks get sequential IDs like `{spec-id}-1`, `{spec-id}-2`, etc.
- `priority`: Lower number = higher priority (1 = first to implement)
- `status`: "pending" for unstarted, "in_progress" for active, "completed" for done
- `context`: Include relevant code paths, dependencies, or notes for the build agent

### 4. Create Missing Specs
If functionality is needed but no spec exists:
1. Search codebase to confirm it's actually missing
2. Create spec at `.ralph-wiggum/specs/FILENAME.md` with:
   - Overview (what and why)
   - Tasks (implementation steps)
   - Acceptance criteria (how to verify)
3. Add to implementation.json with appropriate priority

### 5. Update Guardrails (if needed)
If you discover project-specific rules that should be enforced, add them to the "Project-Specific Rules" section of @.ralph-wiggum/GUARDRAILS.md.

COMPLETION: When all specs are audited, have clear tasks/acceptance criteria, and implementation.json is created/updated, output exactly: <STATUS>DONE</STATUS>