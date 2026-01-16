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
- Use Bun for all scripts: `bun run test`, `bun run build`, `bun run typecheck`
- Follow existing patterns: Commander for CLI, picocolors for terminal colors
- When adding new dependencies, verify they work with Bun bundler
- For TUI work: Use `@opentui/react` for React-based TUI, `@clack/prompts` only for init flow
- TUI components use Tokyo Night color palette - import from `lib/constants.ts` (once created)
- TUI types (Task, ParsedPlan, etc.) should be imported from `types.ts` (once created)
- TypeScript strict mode is enabled - all types must be explicit
- Test files go in `src/__tests__/` with `.test.ts` extension
