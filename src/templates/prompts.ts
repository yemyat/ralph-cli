export const PROMPT_PLAN = `0a. Study \`.ralph/specs/*\` with up to 250 parallel subagents to learn the application specifications.
0b. Study @.ralph/IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study \`src/lib/*\` with up to 250 parallel subagents to understand shared utilities & components.
0d. For reference, the application source code is in \`src/*\`.

1. Study @.ralph/IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and use up to 500 subagents to study existing source code in \`src/*\` and compare it against \`.ralph/specs/*\`. Use a subagent to analyze findings, prioritize tasks, and create/update @.ralph/IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Ultrathink. Consider searching for TODO, minimal implementations, placeholders, skipped/flaky tests, and inconsistent patterns. Study @.ralph/IMPLEMENTATION_PLAN.md to determine starting point for research and keep it up to date with items considered complete/incomplete using subagents.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality is missing; confirm with code search first. Treat \`src/lib\` as the project's standard library for shared utilities and components. Prefer consolidated, idiomatic implementations there over ad-hoc copies.

ULTIMATE GOAL: We want to achieve the project goals defined in .ralph/specs/. Consider missing elements and plan accordingly. If an element is missing, search first to confirm it doesn't exist, then if needed author the specification at .ralph/specs/FILENAME.md. If you create a new element then document the plan to implement it in @.ralph/IMPLEMENTATION_PLAN.md using a subagent.`;

export const PROMPT_BUILD = `0a. Study \`.ralph/specs/*\` with up to 500 parallel subagents to learn the application specifications.
0b. Study @.ralph/IMPLEMENTATION_PLAN.md.
0c. For reference, the application source code is in \`src/*\`.

1. Your task is to implement functionality per the specifications using parallel subagents. Follow @.ralph/IMPLEMENTATION_PLAN.md and choose the most important item to address. Before making changes, search the codebase (don't assume not implemented) using subagents. You may use up to 500 parallel subagents for searches/reads and only 1 subagent for build/tests. Use subagents when complex reasoning is needed (debugging, architectural decisions).
2. After implementing functionality or resolving problems, run the tests for that unit of code that was improved. If functionality is missing then it's your job to add it as per the application specifications. Ultrathink.
3. When you discover issues, immediately update @.ralph/IMPLEMENTATION_PLAN.md with your findings using a subagent. When resolved, update and remove the item.
4. When the tests pass, update @.ralph/IMPLEMENTATION_PLAN.md, then \`git add -A\` then \`git commit\` with a message describing the changes. After the commit, \`git push\`.

99999. Important: When authoring documentation, capture the why — tests and implementation importance.
999999. Important: Single sources of truth, no migrations/adapters. If tests unrelated to your work fail, resolve them as part of the increment.
9999999. As soon as there are no build or test errors create a git tag.`;

export const AGENTS_MD = `# AGENTS.md

This file contains operational guidance for the AI agents working on this project.

## Project Overview
<!-- Describe your project here -->

## Build & Test Commands
\`\`\`bash
# Add your build commands
npm run build

# Add your test commands
npm test
\`\`\`

## Code Conventions
- Follow existing code style
- Use TypeScript strict mode
- Write tests for new functionality

## Important Notes
- Always run tests before committing
- Keep commits atomic and well-described
`;

export const IMPLEMENTATION_PLAN_TEMPLATE = `# Implementation Plan

## Current Status
- [ ] Initial planning phase

## Tasks (Priority Order)

### High Priority
<!-- Tasks will be added here by the AI -->

### Medium Priority
<!-- Tasks will be added here by the AI -->

### Low Priority
<!-- Tasks will be added here by the AI -->

## Completed
<!-- Completed tasks will be moved here -->

## Discovered Issues
<!-- Issues found during implementation -->
`;
