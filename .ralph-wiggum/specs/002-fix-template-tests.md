# Fix Template Test Failures

## Overview
The template prompts were updated to use `.ralph-wiggum/` directory structure instead of `.ralph/`, but the corresponding tests in `templates.test.ts` still check for the old paths and deprecated sections. This causes 5 test failures.

## Tasks
- [x] Update test expectations in `templates.test.ts` to use `.ralph-wiggum/specs` instead of `.ralph/specs`
- [x] Remove test for `git tag` since it's no longer in PROMPT_BUILD template
- [x] Update IMPLEMENTATION_PLAN_TEMPLATE test to check for new sections (In Progress, Backlog, Completed) instead of old ones (Current Status, High/Medium/Low Priority, Discovered Issues)
- [x] Remove checkbox syntax test since template now uses HTML comments instead

## Acceptance Criteria
- [x] AC 1: `bun run test` passes with 0 failures
- [x] AC 2: All assertions in `templates.test.ts` match actual template content
- [x] AC 3: No test logic removed that still applies to current templates

## Notes
- Root cause: Commit `0f81d21` changed folder directory but didn't update tests
- Tests that fail:
  1. `PROMPT_PLAN > contains expected sections for planning mode`
  2. `PROMPT_BUILD > contains expected sections for build mode`
  3. `PROMPT_BUILD > includes guidance about git tagging on success`
  4. `IMPLEMENTATION_PLAN_TEMPLATE > contains expected markdown structure`
  5. `IMPLEMENTATION_PLAN_TEMPLATE > uses markdown checkbox syntax`
