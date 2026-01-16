# Migrate TUI from Ink to OpenTUI (and standardize prompts)

## Overview
Today we have overlapping terminal UI libraries (`ink`, `ink-spinner`, `inquirer`, `@clack/prompts`).
This spec standardizes on:

- `@clack/prompts` for step-by-step setup flows (e.g. `ralph-wiggum-cli init`)
- OpenTUI (`@opentui/core` + `@opentui/react`) for the full-screen interactive TUI (`src/tui`)

The existing Ink-based TUI in `src/tui` is ported to OpenTUI while preserving the behaviors from the
existing TUI specs (e.g. kanban navigation, scrollable panels, stop-in-progress tasks).

## Tasks
- [x] Decide and document the terminal UX stack: clack for setup prompts, OpenTUI for TUI
- [x] Add OpenTUI deps: `@opentui/core` and `@opentui/react`
- [x] Update the TUI entrypoint (`src/commands/tui.ts`) to render OpenTUI instead of Ink
- [x] Port TUI layout primitives from Ink to OpenTUI equivalents (`box`, `text`, `scrollbox`, etc.)
- [x] Preserve keyboard navigation behaviors from:
  - [x] `.ralph-wiggum/specs/001-interactive-tui.md`
  - [x] `.ralph-wiggum/specs/002-vim-keybindings.md`
  - [x] `.ralph-wiggum/specs/003-scrollable-panels.md`
  - [x] `.ralph-wiggum/specs/004-stop-in-progress-tasks.md`
- [x] Add a headless, machine-testable TUI harness using OpenTUI testing utilities
- [x] Replace Ink spinners/loading states with OpenTUI-native UI (no `ink-spinner`)
- [x] Remove unused/overlapping deps: `ink`, `ink-spinner`, `inquirer`, and `@types/inquirer`
- [x] Update docs to reflect new requirements (Bun runtime, OpenTUI native requirements)

## Acceptance Criteria (machine-verifiable)
- [x] AC 1: Typecheck passes: `bun run typecheck`
- [x] AC 2: Tests pass: `bun test`
- [x] AC 3: Build succeeds under Bun: `bun run build`
- [x] AC 4: Source no longer imports Ink/Inquirer:
  - [x] `rg -n \"from \\\"ink\\\"|from 'ink'|ink-spinner|inquirer\" src` returns no matches
- [x] AC 5: `package.json` no longer lists removed deps (checked via a script):
  - [x] `bun -e 'import pkg from \"./package.json\"; const banned=[\"ink\",\"ink-spinner\",\"inquirer\",\"@types/inquirer\"]; const present=banned.filter((d)=>pkg.dependencies?.[d]||pkg.devDependencies?.[d]); if(present.length){console.error(present.join(\"\\n\")); process.exit(1)}'`
- [x] AC 6: `package.json` includes OpenTUI deps (checked via a script):
  - [x] `bun -e 'import pkg from \"./package.json\"; const required=[\"@opentui/core\",\"@opentui/react\"]; const missing=required.filter((d)=>!pkg.dependencies?.[d]); if(missing.length){console.error(missing.join(\"\\n\")); process.exit(1)}'`
- [x] AC 7: `src/commands/tui.ts` uses OpenTUI renderer (no Ink `render()`):
  - [x] `rg -n \"@opentui/(core|react)\" src/commands/tui.tsx` matches
  - [x] `rg -n \"from \\\"ink\\\"|from 'ink'\" src/commands/tui.tsx` returns no matches
- [x] AC 8: `src/tui/` is fully ported to OpenTUI (no Ink components remain):
  - [x] `rg -n \"@opentui/(core|react)\" src/tui` matches
  - [x] `rg -n \"from \\\"ink\\\"|from 'ink'|ink-spinner\" src/tui` returns no matches
- [x] AC 9: There is at least one headless TUI test using OpenTUI's test renderer:
  - [x] `rg -n \"createTestRenderer\\(\" src/__tests__` matches
- [x] AC 10: Headless tests verify core interactions by asserting captured frames contain expected text:
  - [x] Initial frame contains column headers (`BACKLOG`, `IN PROGRESS`, `COMPLETED`)
  - [x] Pressing navigation keys changes the captured frame (selection moves)
  - [x] Enter opens detail view; Esc returns to kanban
  - [x] Tab switches focus between spec/log panels; scrolling changes the visible content
  - [x] Stop flow: on an in-progress task, `s` or `x` shows confirmation; `y` triggers "Stopping…"
- [x] AC 11: If the TUI is launched without Bun, the CLI exits with a clear error message (guarded in code):
  - [x] `rg -n \"process\\.versions\\.bun\" src/commands/tui.tsx` matches
- [x] AC 12: Setup flows continue to use `@clack/prompts` (and do not use Inquirer):
  - [x] `rg -n \"from \\\"@clack/prompts\\\"\" src/commands/init.ts` matches
  - [x] `rg -n \"inquirer\" src/commands/init.ts` returns no matches

## Target UX
No intentional UX change: the OpenTUI implementation should match the existing Ink TUI's visual
structure and keybindings.

## Notes
- OpenTUI is Bun-first and uses a native renderer; ensure the CLI runs under Bun and prints a clear
  error if the OpenTUI native module can't load (e.g. missing platform binary / toolchain).
- Prefer OpenTUI's built-in testing utilities (`@opentui/core/testing`) over `tmux` capture for
  stable, machine-verifiable assertions.
