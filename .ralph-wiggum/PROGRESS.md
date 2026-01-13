# Progress Log

Audit trail of completed work. Each entry records what was done, verification results, and learnings.

---

## [2026-01-13 14:30] - Interactive TUI with Kanban Board

**Commit:** `e097cdb` feat: add interactive TUI with kanban board

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run lint` → PASS
- `bun run test` → PASS
- `bun run build` → PASS

**Files changed:**
- src/commands/init.ts (refactored to use @clack/prompts)
- src/commands/tui.ts (new TUI command)
- src/index.ts (default TUI action)
- src/tui/app.tsx (main TUI app component)
- src/tui/kanban.tsx (kanban board component)
- src/tui/card.tsx (task card component)
- src/tui/detail-view.tsx (spec+log split view)
- src/tui/spec-viewer.tsx (markdown spec viewer)
- src/tui/log-viewer.tsx (log streaming viewer)
- src/tui/utils.ts (plan parsing utilities)
- tsconfig.json (added JSX support)
- package.json (added ink, react, @clack/prompts deps)

**What was done:**
1. Added Ink-based TUI that launches when running `ralph-wiggum-cli` with no args
2. Implemented Kanban board with 3 columns (Backlog, In Progress, Completed)
3. Refactored init command to use @clack/prompts for better interactive UX
4. Created spec viewer with basic markdown rendering (headers, tasks, lists)
5. Created log viewer with real-time streaming for in-progress tasks
6. Implemented keyboard navigation (←→ columns, ↑↓ items, Enter, Esc)
7. Task cards show status icons (○ backlog, ● in progress, ✓ completed)

**Learnings:**
- Ink requires `react-devtools-core` as a dev dependency for Bun builds
- Biome lint requires kebab-case filenames for tsx files
- Cognitive complexity limits (20) require extracting helper functions
- @clack/prompts functions should be imported individually, not as namespace

---

## [2026-01-13 12:10] - Fix Template Test Failures

**Commit:** `423c6e4` feat: fix template tests to match .ralph-wiggum directory structure

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run test` → PASS
- `bun run build` → PASS

**Files changed:**
- src/__tests__/templates.test.ts

**What was done:**
Updated test expectations in templates.test.ts to align with the .ralph-wiggum/ directory structure changes. Fixed 5 failing tests:
1. Changed `.ralph/specs` to `.ralph-wiggum/specs` in PROMPT_PLAN and PROMPT_BUILD tests
2. Removed git tag test (no longer in PROMPT_BUILD)
3. Updated IMPLEMENTATION_PLAN_TEMPLATE tests to check for new sections (In Progress, Backlog, Completed) instead of old ones
4. Changed checkbox syntax test to HTML comment test

**Learnings:**
- Template path references changed from `.ralph/` to `.ralph-wiggum/` in commit 0f81d21
- Tests must match exact case in string assertions (e.g., "do NOT implement" vs "Do NOT implement")

---
