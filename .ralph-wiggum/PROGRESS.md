# Progress Log

Audit trail of completed work. Each entry records what was done, verification results, and learnings.

---

## [2026-01-16 22:00] - Extract Keyboard Navigation Hook (Partial)

**Commit:** `423273a` feat: add useKeyboardNavigation hook

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run lint` → PASS
- `bun run test` → PASS (146 tests, +13 new)
- `bun run build` → PASS

**Files changed:**
- src/tui/hooks/use-keyboard-navigation.ts (NEW - vim-style navigation hook)
- src/tui/hooks/__tests__/use-keyboard-navigation.test.ts (NEW - 13 type/interface tests)
- package.json (added @testing-library/react for future hook testing)
- .ralph-wiggum/specs/006-extract-keyboard-navigation-hook.md (updated with progress)
- .ralph-wiggum/IMPLEMENTATION_PLAN.md (moved spec to In Progress)

**What was done:**
1. Created src/tui/hooks/ directory structure
2. Implemented useKeyboardNavigation hook with:
   - VimMode state machine (normal/search/command)
   - Navigation handlers (j/k, gg/G, arrow keys)
   - Search functionality (query building, match finding, n/N navigation)
   - Command mode (:q/:quit handling)
   - Double-tap detection for gg
   - Configurable options (wrap, onExit, onCommand)
3. Exported types: KeyEvent, NavOptions, SearchState, NavigationState, NavigationHandlers
4. Created tests verifying hook exports and TypeScript types
5. Note: Hook behavioral tests limited due to Bun lacking DOM/jsdom for React hook testing

**Remaining Work:**
- Wire hook into app.tsx replacing inline useState calls
- Ensure all existing keyboard shortcuts work identically
- Verify no visual/behavioral regression in TUI

**Learnings:**
- React hooks with useState cannot be easily tested in Bun without jsdom
- @testing-library/react requires DOM environment (document)
- Pure type verification tests still provide value for hook exports
- Extracting callbacks (handleModeTransition, handleNavigationKey) reduces cognitive complexity

---

## [2026-01-16 21:00] - Modularize Utils

**Commit:** `285f4a7` feat: modularize TUI utils into focused modules

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run lint` → PASS
- `bun run test` → PASS (133 tests, +24 new)
- `bun run build` → PASS

**Files changed:**
- src/tui/lib/plan-parser.ts (NEW - pure plan parsing functions)
- src/tui/lib/spec-parser.ts (NEW - pure spec parsing functions)
- src/tui/lib/file-operations.ts (NEW - file I/O utilities)
- src/tui/lib/__tests__/plan-parser.test.ts (NEW - 12 tests)
- src/tui/lib/__tests__/spec-parser.test.ts (NEW - 7 tests)
- src/tui/lib/__tests__/file-operations.test.ts (NEW - 16 tests)
- src/tui/app.tsx (updated imports to use lib/file-operations)
- src/tui/utils.ts (DELETED - replaced by modular files)
- .ralph-wiggum/specs/009-modularize-utils.md (marked complete)
- .ralph-wiggum/IMPLEMENTATION_PLAN.md (moved spec to completed)

**What was done:**
1. Created plan-parser.ts with `parseImplementationPlanContent()` pure function and helper exports
2. Created spec-parser.ts with `parseSpecContent()` for structured spec parsing
3. Created file-operations.ts with all file I/O: `parseImplementationPlan`, `readSpecContent`, `readLogContent`, `getLatestSessionLog`, `appendToLog`, `markTaskAsStopped`, `getAllSpecs`
4. Fixed bug in `findTaskAndBacklogPositions()` that broke early before finding backlog section
5. Updated app.tsx to import from `./lib/file-operations` instead of `./utils`
6. Deleted original utils.ts (326 lines)
7. Added 24 new tests covering all three modules

**Learnings:**
- Breaking out of a loop early to avoid scanning the whole file can miss required data (backlog index)
- Pure functions (plan-parser, spec-parser) are trivial to unit test without mocking
- Top-level regex constants are required by Biome's `useTopLevelRegex` lint rule
- Module organization: types → pure parsers → I/O (no circular deps)

---

## [2026-01-16 14:00] - Centralize Theme and Types

**Commit:** `ea0e2df` feat: centralize theme and types for TUI

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run lint` → PASS
- `bun run test` → PASS (98 tests)
- `bun run build` → PASS

**Files changed:**
- src/tui/types.ts (NEW - centralized type definitions)
- src/tui/lib/constants.ts (NEW - Tokyo Night theme constants, STATUS_ICONS, TIMING)
- src/tui/app.tsx (imports from types.ts and constants.ts)
- src/tui/card.tsx (uses STATUS_COLORS, STATUS_ICONS from constants)
- src/tui/confirm-dialog.tsx (uses TOKYO_NIGHT colors)
- src/tui/detail-view.tsx (uses TOKYO_NIGHT colors, imports types from types.ts)
- src/tui/help-overlay.tsx (uses TOKYO_NIGHT colors)
- src/tui/kanban.tsx (uses TOKYO_NIGHT colors, imports types from types.ts)
- src/tui/log-viewer.tsx (uses TOKYO_NIGHT colors)
- src/tui/sidebar.tsx (uses STATUS_COLORS, STATUS_ICONS)
- src/tui/spec-viewer.tsx (uses TOKYO_NIGHT colors)
- src/tui/task-detail.tsx (uses STATUS_COLORS, STATUS_ICONS, TOKYO_NIGHT)
- src/tui/utils.ts (re-exports types from types.ts)
- src/__tests__/tui.test.tsx (updated tests for new sidebar layout)
- .ralph-wiggum/specs/008-centralize-theme-and-types.md (marked complete)
- .ralph-wiggum/IMPLEMENTATION_PLAN.md (moved spec to completed)

**What was done:**
1. Created src/tui/types.ts with Task, TaskStatus, ParsedPlan, VimMode, DialogType, FocusedPanel, ScrollState, SearchState
2. Created src/tui/lib/constants.ts with TOKYO_NIGHT palette, STATUS_ICONS, STATUS_COLORS, TIMING, LAYOUT
3. Updated all TUI components to import types from types.ts instead of utils.ts
4. Replaced all inline hex color codes (#7aa2f7, #e0af68, etc.) with TOKYO_NIGHT constants
5. Simplified status icon/color logic using STATUS_ICONS and STATUS_COLORS maps
6. Removed emoji icons from components for cleaner rendering
7. Updated TUI tests for new sidebar-based layout (was kanban columns)

**Learnings:**
- The `as const` assertion on constant objects enables TypeScript to infer literal types
- Re-exporting types with `export type { X } from "./module"` is cleaner than importing and re-exporting separately
- STATUS_COLORS map eliminates repetitive switch statements for task status coloring
- Grep verification confirms all Tokyo Night colors are centralized in constants.ts only

---

## [2026-01-16 12:00] - Fix Lint Errors in TUI Tests

**Commit:** `ffa8cb4` fix: lint errors in TUI tests (imports, regex, formatting)

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run lint` → PASS
- `bun run test` → PASS (98 tests)
- `bun run build` → PASS

**Files changed:**
- src/__tests__/tui.test.tsx (fixed import order, moved regex to top-level, fixed formatting)

**What was done:**
1. Fixed import organization (node:path before @opentui packages)
2. Moved regex literal to top-level scope (SCROLL_POSITION_REGEX constant)
3. Fixed formatting of createTestRenderer calls per Biome style rules

**Learnings:**
- Biome organizeImports requires node: imports before external packages
- Regex literals used in function scope trigger useTopLevelRegex lint error
- Biome formatting prefers function call arguments on separate lines with specific indentation

---

## [2026-01-16 10:00] - OpenTUI Migration

**Commit:** `65571d2` feat: migrate TUI from Ink to OpenTUI

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run lint` → PASS
- `bun run test` → PASS (98 tests including 8 new TUI tests)
- `bun run build` → PASS

**Files changed:**
- package.json (added @opentui/core, @opentui/react; removed ink, ink-spinner, inquirer, @types/inquirer)
- bun.lock (updated dependencies)
- tsconfig.json (changed moduleResolution to "bundler", added jsxImportSource for OpenTUI)
- src/commands/tui.tsx (renamed from .ts, now uses OpenTUI createCliRenderer/createRoot)
- src/commands/tui.ts (deleted)
- src/tui/app.tsx (ported from Ink to OpenTUI, using useKeyboard, useRenderer, useTerminalDimensions)
- src/tui/kanban.tsx (ported to OpenTUI, using TextAttributes for styling)
- src/tui/card.tsx (ported to OpenTUI, using TextAttributes.BOLD | TextAttributes.INVERSE)
- src/tui/detail-view.tsx (ported to OpenTUI primitives)
- src/tui/spec-viewer.tsx (ported to OpenTUI primitives)
- src/tui/log-viewer.tsx (ported to OpenTUI primitives)
- src/tui/help-overlay.tsx (ported to OpenTUI primitives)
- src/tui/confirm-dialog.tsx (ported to OpenTUI primitives)
- src/tui/loading-spinner.tsx (new custom spinner component replacing ink-spinner)
- src/__tests__/tui.test.tsx (new headless TUI tests using @opentui/core/testing)
- .ralph-wiggum/specs/005-opentui-tui-migration.md (marked tasks complete)
- .ralph-wiggum/IMPLEMENTATION_PLAN.md (moved spec to Completed)

**What was done:**
1. Added OpenTUI dependencies (@opentui/core and @opentui/react v0.1.73)
2. Removed Ink-based dependencies (ink, ink-spinner, inquirer, @types/inquirer)
3. Updated tsconfig.json for OpenTUI JSX support (moduleResolution: bundler, jsxImportSource)
4. Renamed src/commands/tui.ts to .tsx and ported to OpenTUI renderer
5. Added Bun runtime check to exit with clear error if not running under Bun
6. Ported all TUI components from Ink to OpenTUI:
   - useInput → useKeyboard for keyboard handling
   - useApp → useRenderer for exit handling
   - useStdout → useTerminalDimensions for dimensions
   - React.ReactElement → React.ReactNode for return types
   - Text bold/inverse → TextAttributes bitwise OR flags
7. Created custom LoadingSpinner component using useState/useEffect intervals
8. Added 8 headless TUI tests using @opentui/core/testing createTestRenderer
9. Tests verify column headers, task display, footer counts, detail view, search mode, scroll indicators
10. All 12 acceptance criteria verified and passing

**Learnings:**
- OpenTUI uses `box` and `text` primitives similar to Ink, but with different prop names
- TextAttributes use bitwise OR to combine flags (BOLD | INVERSE)
- biome-ignore comments needed for intentional bitwise operators
- OpenTUI testing utilities (createTestRenderer, mockInput, captureCharFrame) work well for headless tests
- renderer.idle() helpful for waiting for async state updates in tests
- Return types must be React.ReactNode instead of React.ReactElement

---

## [2026-01-13 19:00] - Stop In-Progress Tasks

**Commit:** `574277f` feat: add stop in-progress tasks functionality to TUI

**Guardrails:**
- Pre-flight: ✓
- Post-flight: ✓

**Verification:**
- `bun run typecheck` → PASS
- `bun run lint` → PASS
- `bun run test` → PASS
- `bun run build` → PASS

**Files changed:**
- src/tui/app.tsx (added stop state, confirmation dialogs, SIGTERM/SIGKILL handling)
- src/tui/utils.ts (added markTaskAsStopped, appendToLog, stopped task parsing)
- src/tui/card.tsx (added stopped status icon ■ and red color)
- src/tui/kanban.tsx (added stopped prop, spinner for stopping tasks)
- src/tui/confirm-dialog.tsx (new component for stop/force-kill dialogs)
- .ralph-wiggum/specs/004-stop-in-progress-tasks.md (marked tasks complete)
- .ralph-wiggum/IMPLEMENTATION_PLAN.md (moved spec to Completed)

**What was done:**
1. Added `s`/`x` keybindings to trigger stop confirmation on in-progress tasks
2. Created ConfirmDialog component for stop confirmation and force-kill prompts
3. Implemented SIGTERM graceful shutdown with 5-second timeout
4. Added force-kill (SIGKILL) dialog after timeout
5. Added "stopped" status type with ■ icon in red
6. Updated IMPLEMENTATION_PLAN.md parsing to handle `[stopped]` marker
7. Task moves from In Progress to Backlog with `[stopped]` marker when stopped
8. Added spinner and "Stopping..." state during graceful shutdown
9. Logs show termination messages with timestamps
10. Status bar shows `[s] stop` hint when in In Progress column

**Learnings:**
- Need to extract helper functions to reduce cognitive complexity in both app.tsx and utils.ts
- Cannot shadow global `escape` property - use `isEscapeKey` instead
- Process signal 0 can be used to check if process is still running without sending a signal
- Stopped tasks display in Backlog column but retain their "stopped" status for distinct styling

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
