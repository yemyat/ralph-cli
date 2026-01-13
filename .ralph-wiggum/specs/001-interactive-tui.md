# Interactive TUI with Kanban Board

## Overview
Replace the current CLI-only experience with a visual TUI using Ink. Show a kanban board with Backlog, In Progress, and Completed columns. Users can navigate and drill into tasks to view specs and real-time logs.

## Tasks
- [ ] Add dependencies: `ink`, `react`, `@clack/prompts`, `ink-spinner`
- [ ] Create tmux test harness for capturing TUI context
- [ ] Refactor `init` command to use `@clack/prompts` for interactive setup
- [ ] Build Ink-based TUI shell with split-pane layout
- [ ] Implement Kanban board component with 3 columns
- [ ] Create task card component (clickable, shows status)
- [ ] Build spec viewer panel (markdown rendering)
- [ ] Build log streaming panel (real-time output)
- [ ] Wire up keyboard navigation (arrows, enter, escape)
- [ ] Integrate with existing session/spec state

## Acceptance Criteria
- [ ] AC 1: `ralph-wiggum-cli init` uses clack/prompts for guided setup (agent selection, model config)
- [ ] AC 2: `ralph-wiggum-cli` (no args) launches Ink TUI with kanban board
- [ ] AC 3: Kanban shows 3 columns: Backlog, In Progress, Completed
- [ ] AC 4: Backlog items are clickable → shows spec content only
- [ ] AC 5: In Progress items are clickable → shows split view with spec + real-time log stream
- [ ] AC 6: Completed items are clickable → shows split view with spec + final log output
- [ ] AC 7: tmux can be used to run and capture TUI output for testing
- [ ] AC 8: Keyboard navigation: ←→ switch columns, ↑↓ select items, Enter to drill in, Esc to go back

## Notes
- Use `ink` for main TUI, `@clack/prompts` only for init flow
- Logs stream from `.ralph-wiggum/logs/<session-id>.log`
- Specs live in `.ralph-wiggum/specs/*.md`
- Consider `ink-big-text` for header, `ink-spinner` for loading states
- tmux capture: `tmux capture-pane -p` to grab current state for assertions
