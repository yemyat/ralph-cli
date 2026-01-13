# Progress Log

Audit trail of completed work. Each entry records what was done, verification results, and learnings.

---

## [2026-01-13 17:30] - Scrollable Spec & Logs Panels

**Commit:** `578b7e4` feat: add scrollable panels to TUI detail view

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run lint` → PASS
- `bun run test` → PASS
- `bun run build` → PASS

**Files changed:**
- src/tui/app.tsx (added scroll state, panel focus, keyboard handlers for detail view)
- src/tui/detail-view.tsx (accepts focusedPanel, scroll offsets, autoFollow props)
- src/tui/spec-viewer.tsx (added isFocused, scrollOffset props, scroll indicators)
- src/tui/log-viewer.tsx (added isFocused, scrollOffset, autoFollow props, scroll indicators)
- .ralph-wiggum/specs/003-scrollable-panels.md (marked tasks complete)
- .ralph-wiggum/IMPLEMENTATION_PLAN.md (moved spec to Completed)

**What was done:**
1. Added scroll offset state for spec and logs panels
2. Implemented Tab to switch focus between spec and logs panels
3. Focused panel shows bold cyan border highlight
4. Added j/k and ↑/↓ for line-by-line scrolling
5. Added gg to scroll to top, G to scroll to bottom
6. Added Ctrl+U/Ctrl+D for half-page scrolling
7. Added scroll indicators (▲▼) showing content above/below viewport
8. Added scroll position display (e.g., "1-15/45")
9. Logs panel auto-follows new content when autoFollow is enabled
10. Added f key to toggle auto-follow mode for logs
11. Scrolling up manually pauses auto-follow, G or f re-enables it
12. Esc still exits detail view (not consumed by scroll handlers)

**Learnings:**
- Panel focus switching only applies in split view (not for backlog items which show spec only)
- Auto-follow for logs should pause when user scrolls up but resume on G or f toggle
- Helper functions for scroll indicators avoid nested ternary lint errors
- Block statements required for all if statements by lint rules

---

## [2026-01-13 16:45] - Vim Key Bindings

**Commit:** `8de0f66` feat: add vim keybindings to TUI

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run lint` → PASS
- `bun run test` → PASS
- `bun run build` → PASS

**Files changed:**
- src/tui/app.tsx (added vim keybindings, search mode, command mode, help overlay)
- src/tui/help-overlay.tsx (new component for keybinding help)
- .ralph-wiggum/specs/002-vim-keybindings.md (marked tasks complete)
- .ralph-wiggum/IMPLEMENTATION_PLAN.md (moved spec to Completed)

**What was done:**
1. Implemented hjkl navigation (h/l for columns, j/k for items)
2. Added `gg` double-tap detection to jump to first item (300ms timeout)
3. Added `G` to jump to last item in current column
4. Implemented `/` search mode with real-time filtering
5. Added `n`/`N` navigation between search matches
6. Implemented `:q` command mode for quitting
7. Added `?` help overlay showing all keybindings
8. Added `o` as alternative to Enter for opening tasks
9. Status bar updates to show current mode (normal/search/command)

**Learnings:**
- Cognitive complexity limits require aggressive function extraction
- useCallback with multiple helpers keeps complexity under 20
- Switch statements for single-char handlers reduce branching complexity
- Double-tap detection needs useRef to persist across renders
- 1-9 number keys for quick jump not implemented (marked as future enhancement)

---

## [2026-01-13 14:30] - Interactive TUI with Kanban Board

**Commit:** `85592e6` feat: add interactive TUI with kanban board

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
