# Migrate TUI from Ink to OpenTUI (and standardize prompts)

## Overview
Today we have overlapping terminal UI libraries (`ink`, `ink-spinner`, `inquirer`, `@clack/prompts`).
This spec standardizes on:

- `@clack/prompts` for step-by-step setup flows (e.g. `ralph-wiggum-cli init`)
- OpenTUI (`@opentui/core` + `@opentui/react`) for the full-screen interactive TUI (`src/tui`)

The existing Ink-based TUI in `src/tui` is ported to OpenTUI while preserving the behaviors from the
existing TUI specs (e.g. kanban navigation, scrollable panels, stop-in-progress tasks).

## Tasks
- [ ] Decide and document the terminal UX stack: clack for setup prompts, OpenTUI for TUI
- [ ] Add OpenTUI deps: `@opentui/core` and `@opentui/react`
- [ ] Update the TUI entrypoint (`src/commands/tui.ts`) to render OpenTUI instead of Ink
- [ ] Port TUI layout primitives from Ink to OpenTUI equivalents (`box`, `text`, `scrollbox`, etc.)
- [ ] Preserve keyboard navigation behaviors from:
  - [ ] `.ralph-wiggum/specs/001-interactive-tui.md`
  - [ ] `.ralph-wiggum/specs/002-vim-keybindings.md`
  - [ ] `.ralph-wiggum/specs/003-scrollable-panels.md`
  - [ ] `.ralph-wiggum/specs/004-stop-in-progress-tasks.md`
- [ ] Add a headless, machine-testable TUI harness using OpenTUI testing utilities
- [ ] Replace Ink spinners/loading states with OpenTUI-native UI (no `ink-spinner`)
- [ ] Remove unused/overlapping deps: `ink`, `ink-spinner`, `inquirer`, and `@types/inquirer`
- [ ] Update docs to reflect new requirements (Bun runtime, OpenTUI native requirements)

## Acceptance Criteria (machine-verifiable)
- [ ] AC 1: Typecheck passes: `bun run typecheck`
- [ ] AC 2: Tests pass: `bun test`
- [ ] AC 3: Build succeeds under Bun: `bun run build`
- [ ] AC 4: Source no longer imports Ink/Inquirer:
  - [ ] `rg -n \"from \\\"ink\\\"|from 'ink'|ink-spinner|inquirer\" src` returns no matches
- [ ] AC 5: `package.json` no longer lists removed deps (checked via a script):
  - [ ] `bun -e 'import pkg from \"./package.json\"; const banned=[\"ink\",\"ink-spinner\",\"inquirer\",\"@types/inquirer\"]; const present=banned.filter((d)=>pkg.dependencies?.[d]||pkg.devDependencies?.[d]); if(present.length){console.error(present.join(\"\\n\")); process.exit(1)}'`
- [ ] AC 6: `package.json` includes OpenTUI deps (checked via a script):
  - [ ] `bun -e 'import pkg from \"./package.json\"; const required=[\"@opentui/core\",\"@opentui/react\"]; const missing=required.filter((d)=>!pkg.dependencies?.[d]); if(missing.length){console.error(missing.join(\"\\n\")); process.exit(1)}'`
- [ ] AC 7: `src/commands/tui.ts` uses OpenTUI renderer (no Ink `render()`):
  - [ ] `rg -n \"@opentui/(core|react)\" src/commands/tui.ts` matches
  - [ ] `rg -n \"from \\\"ink\\\"|from 'ink'\" src/commands/tui.ts` returns no matches
- [ ] AC 8: `src/tui/` is fully ported to OpenTUI (no Ink components remain):
  - [ ] `rg -n \"@opentui/(core|react)\" src/tui` matches
  - [ ] `rg -n \"from \\\"ink\\\"|from 'ink'|ink-spinner\" src/tui` returns no matches
- [ ] AC 9: There is at least one headless TUI test using OpenTUI’s test renderer:
  - [ ] `rg -n \"createTestRenderer\\(\" src/__tests__` matches
- [ ] AC 10: Headless tests verify core interactions by asserting captured frames contain expected text:
  - [ ] Initial frame contains column headers (`BACKLOG`, `IN PROGRESS`, `COMPLETED`)
  - [ ] Pressing navigation keys changes the captured frame (selection moves)
  - [ ] Enter opens detail view; Esc returns to kanban
  - [ ] Tab switches focus between spec/log panels; scrolling changes the visible content
  - [ ] Stop flow: on an in-progress task, `s` or `x` shows confirmation; `y` triggers “Stopping…”
- [ ] AC 11: If the TUI is launched without Bun, the CLI exits with a clear error message (guarded in code):
  - [ ] `rg -n \"process\\.versions\\.bun\" src/commands/tui.ts` matches
- [ ] AC 12: Setup flows continue to use `@clack/prompts` (and do not use Inquirer):
  - [ ] `rg -n \"from \\\"@clack/prompts\\\"\" src/commands/init.ts` matches
  - [ ] `rg -n \"inquirer\" src/commands/init.ts` returns no matches

## Target UX
No intentional UX change: the OpenTUI implementation should match the existing Ink TUI’s visual
structure and keybindings.

## Notes
- OpenTUI is Bun-first and uses a native renderer; ensure the CLI runs under Bun and prints a clear
  error if the OpenTUI native module can’t load (e.g. missing platform binary / toolchain).
- Prefer OpenTUI’s built-in testing utilities (`@opentui/core/testing`) over `tmux` capture for
  stable, machine-verifiable assertions.
