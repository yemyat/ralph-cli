# Guardrails

Compliance rules to verify before and after making changes.

## Before Making Changes
- [ ] Read the relevant spec file completely
- [ ] Understand acceptance criteria before coding
- [ ] Search codebase to confirm current state (don't assume)
- [ ] Check for existing patterns to follow

## After Making Changes
- [ ] All acceptance criteria in the spec are met
- [ ] Tests pass: `bun run test`
- [ ] Types check: `bun run typecheck`
- [ ] Build succeeds: `bun run build`
- [ ] No regressions in unrelated functionality

## Project-Specific Rules
<!-- Add project-specific guardrails here -->
