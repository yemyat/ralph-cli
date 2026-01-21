# [Feature Name]

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
<!-- Keep tasks milestone-level: aim for 3–10 tasks that are each "one build-loop" sized.
Avoid micro-tasks like "add 3 constants" or "rename an export" — list those as notes instead.
Optional: Add a coarse estimate prefix like "(SP:3)" to help planning. -->
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

## Verification
<!-- Baseline verification is already part of the build loop (typecheck/tests/build).
Only list additional verification here when it's truly extra (new tests, manual QA steps, migrations, deployments). -->
- [ ] Baseline: `bun run typecheck`, `bun run test`, `bun run build`
- [ ] Frontend (UI changes): Use `agent-browser` to navigate to the relevant screen, exercise the full user flow, and capture a screenshot for `.ralph-wiggum/PROGRESS.md` (example: "Open Settings → toggle X → verify Y updates")
- [ ] Backend (service/API changes): Add/update unit tests in `src/__tests__/` (example: "Task parsing returns expected JSON"); add integration tests when cross-module behavior changes (example: "CLI command runs end-to-end against a temp workspace"); run `bun run test`

## Notes
<!-- Implementation notes, edge cases, dependencies, security considerations -->
