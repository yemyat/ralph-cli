# Interactive TUI with Kanban Board

## Overview
Replace the current CLI-only experience with a visual TUI using Ink. Show a kanban board with Backlog, In Progress, and Completed columns. Users can navigate and drill into tasks to view specs and real-time logs.

## Tasks
- [x] Add dependencies: `ink`, `react`, `@clack/prompts`, `ink-spinner`
- [x] Create tmux test harness for capturing TUI context
- [x] Refactor `init` command to use `@clack/prompts` for interactive setup
- [x] Build Ink-based TUI shell with split-pane layout
- [x] Implement Kanban board component with 3 columns
- [x] Create task card component (clickable, shows status)
- [x] Build spec viewer panel (markdown rendering)
- [x] Build log streaming panel (real-time output)
- [x] Wire up keyboard navigation (arrows, enter, escape)
- [x] Integrate with existing session/spec state

## Acceptance Criteria
- [x] AC 1: `ralph-wiggum-cli init` uses clack/prompts for guided setup (agent selection, model config)
- [x] AC 2: `ralph-wiggum-cli` (no args) launches Ink TUI with kanban board
- [x] AC 3: Kanban shows 3 columns: Backlog, In Progress, Completed
- [x] AC 4: Backlog items are clickable → shows spec content only
- [x] AC 5: In Progress items are clickable → shows split view with spec + real-time log stream
- [x] AC 6: Completed items are clickable → shows split view with spec + final log output
- [x] AC 7: tmux can be used to run and capture TUI output for testing
- [x] AC 8: Keyboard navigation: ←→ switch columns, ↑↓ select items, Enter to drill in, Esc to go back

## Target UX

### Main Kanban View
```
┌─────────────────────────────────────────────────────────────────────┐
│  🧑‍🚀 Ralph Wiggum CLI                                    [q] quit   │
├──────────────────┬──────────────────┬───────────────────────────────┤
│     BACKLOG      │   IN PROGRESS    │          COMPLETED            │
├──────────────────┼──────────────────┼───────────────────────────────┤
│ ○ Add auth API   │ ● Build TUI      │ ✓ Setup project               │
│ ○ Write tests    │                  │ ✓ Init command                │
│                  │                  │                               │
└──────────────────┴──────────────────┴───────────────────────────────┘
```

### Detail View (In Progress / Completed)
```
┌─────────────────────────────────────────────────────────────────────┐
│  Build TUI                                          [Esc] back      │
├─────────────────────────────┬───────────────────────────────────────┤
│  ## Spec                    │  ## Logs (streaming)                  │
│                             │                                       │
│  - [ ] Add ink deps         │  > Installing dependencies...         │
│  - [ ] Create kanban        │  > Creating src/tui/App.tsx           │
│  - [x] Wire navigation      │  > ✓ Done                             │
└─────────────────────────────┴───────────────────────────────────────┘
```

### Detail View (Backlog only)
```
┌─────────────────────────────────────────────────────────────────────┐
│  Add auth API                                       [Esc] back      │
├─────────────────────────────────────────────────────────────────────┤
│  ## Spec                                                            │
│                                                                     │
│  - [ ] Design API endpoints                                         │
│  - [ ] Implement JWT validation                                     │
│  - [ ] Add rate limiting                                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Notes
- Use `ink` for main TUI, `@clack/prompts` only for init flow
- Logs stream from `.ralph-wiggum/logs/<session-id>.log`
- Specs live in `.ralph-wiggum/specs/*.md`
- Consider `ink-big-text` for header, `ink-spinner` for loading states
- tmux capture: `tmux capture-pane -p` to grab current state for assertions
