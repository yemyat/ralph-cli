# Vim Key Bindings

## Overview
Add Vim-style navigation throughout the TUI for power users. Support hjkl movement, modal behaviors, and common Vim patterns.

## Tasks
- [x] Implement hjkl navigation in kanban view
- [x] Add `/` for search/filter mode
- [x] Add `gg` and `G` for jump to first/last item
- [ ] Add `1-9` number keys for quick column/item jump (not implemented - future enhancement)
- [x] Implement `:q` command mode for quit
- [x] Add visual feedback for current mode (normal/search)

## Acceptance Criteria
- [x] AC 1: `h` moves left (previous column), `l` moves right (next column)
- [x] AC 2: `j` moves down (next item), `k` moves up (previous item)
- [x] AC 3: `Enter` or `o` opens detail view for selected item
- [x] AC 4: `Esc` or `q` returns to previous view (detail → kanban, kanban → quit prompt)
- [x] AC 5: `gg` jumps to first item in column, `G` jumps to last item
- [x] AC 6: `/` enters search mode, filters items by name as you type
- [x] AC 7: `n` and `N` navigate to next/previous search match
- [x] AC 8: `:q` + Enter quits the application
- [x] AC 9: `?` shows keybinding help overlay

## Target UX

### Normal Mode (default)
```
┌─────────────────────────────────────────────────────────────────────┐
│  🧑‍🚀 Ralph Wiggum CLI                    [?] help  [/] search  [:q] │
├──────────────────┬──────────────────┬───────────────────────────────┤
│     BACKLOG      │   IN PROGRESS    │          COMPLETED            │
├──────────────────┼──────────────────┼───────────────────────────────┤
│ ○ Add auth API   │ ▶ Build TUI      │ ✓ Setup project               │
│ ○ Write tests    │                  │ ✓ Init command                │
└──────────────────┴──────────────────┴───────────────────────────────┘
                        [h] ← → [l]   [j] ↓ ↑ [k]
```

### Search Mode
```
┌─────────────────────────────────────────────────────────────────────┐
│  🧑‍🚀 Ralph Wiggum CLI                                 /auth_        │
├──────────────────┬──────────────────┬───────────────────────────────┤
│     BACKLOG      │   IN PROGRESS    │          COMPLETED            │
├──────────────────┼──────────────────┼───────────────────────────────┤
│ ▶ Add auth API   │   Build TUI      │   Setup project               │
│   Write tests    │                  │   Init command                │
└──────────────────┴──────────────────┴───────────────────────────────┘
                        [Enter] select  [Esc] cancel  [n/N] next/prev
```

### Help Overlay
```
┌─────────────────────────────────────────────────────────────────────┐
│                         Keybindings                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Navigation          Actions           Search                       │
│  ──────────          ───────           ──────                       │
│  h/l  left/right     Enter/o  open     /      start search          │
│  j/k  down/up        Esc/q    back     n/N    next/prev match       │
│  gg   first item     :q       quit     Enter  select match          │
│  G    last item      ?        help     Esc    cancel search         │
├─────────────────────────────────────────────────────────────────────┤
│                         [Esc] close                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Notes
- Arrow keys should still work alongside Vim bindings
- Consider adding `ctrl+d` / `ctrl+u` for half-page scroll if list is long
- Mode indicator could be subtle (e.g., cursor style change or status bar text)
- `gg` requires detecting double-tap within ~300ms timeout
