# Scrollable Spec & Logs Panels

## Overview
Enable scrolling within the spec and logs panels in detail view. Long content should be navigable without leaving the detail view.

## Tasks
- [ ] Add scroll state to spec panel (track scroll offset)
- [ ] Add scroll state to logs panel (track scroll offset)
- [ ] Implement panel focus switching (Tab to toggle between spec/logs)
- [ ] Add scroll indicators (e.g., ▲▼ or "more above/below")
- [ ] Auto-scroll logs panel to bottom on new output (with option to pause)
- [ ] Add scroll position indicator (e.g., "23/150 lines" or percentage)

## Acceptance Criteria
- [ ] AC 1: `Tab` switches focus between spec and logs panels
- [ ] AC 2: Focused panel has visible border highlight
- [ ] AC 3: `j`/`k` or `↓`/`↑` scrolls content within focused panel
- [ ] AC 4: `gg` scrolls to top, `G` scrolls to bottom of focused panel
- [ ] AC 5: `ctrl+d` / `ctrl+u` scrolls half-page down/up
- [ ] AC 6: Logs panel auto-scrolls to bottom when new content arrives
- [ ] AC 7: `f` toggles auto-follow mode on/off for logs panel
- [ ] AC 8: Scroll indicators show when content exists above/below viewport
- [ ] AC 9: `Esc` exits detail view (not consumed by scroll)

## Target UX

### Detail View with Focused Spec Panel
```
┌─────────────────────────────────────────────────────────────────────┐
│  Build TUI                                          [Esc] back      │
├─────────────────────────────┬───────────────────────────────────────┤
│ ┃ ## Spec              ▲   ┃│  ## Logs                              │
│ ┃                          ┃│                                       │
│ ┃ - [x] Add ink deps       ┃│  > Installing dependencies...         │
│ ┃ - [x] Create kanban      ┃│  > Creating src/tui/App.tsx           │
│ ┃ - [ ] Wire navigation    ┃│  > Building components...             │
│ ┃ - [ ] Add tests      ▼   ┃│  > ✓ Done                             │
│ ┃                 [12/45]  ┃│                                       │
└─┸───────────────────────────┴───────────────────────────────────────┘
      [j/k] scroll  [Tab] switch panel  [gg/G] top/bottom
```

### Detail View with Focused Logs Panel (auto-follow ON)
```
┌─────────────────────────────────────────────────────────────────────┐
│  Build TUI                                          [Esc] back      │
├─────────────────────────────┬───────────────────────────────────────┤
│  ## Spec                    │ ┃ ## Logs (following)            ▲   ┃│
│                             │ ┃                                    ┃│
│  - [x] Add ink deps         │ ┃ > Creating src/tui/App.tsx         ┃│
│  - [x] Create kanban        │ ┃ > Building components...           ┃│
│  - [ ] Wire navigation      │ ┃ > Running typecheck...             ┃│
│  - [ ] Add tests            │ ┃ > ✓ All checks passed         ▼   ┃│
│                             │ ┃                        [f] follow  ┃│
└─────────────────────────────┴─┸─────────────────────────────────────┘
      [j/k] scroll  [Tab] switch panel  [f] toggle follow
```

### Scroll Indicator States
```
▲    = more content above
▼    = more content below
▲▼   = content above and below (mid-scroll)
     = no indicator when at boundary or content fits
```

## Notes
- Use Ink's `Box` with `overflow="hidden"` and manual offset tracking
- Consider `ink-scroll-area` package or build custom ScrollBox component
- Logs follow mode should pause when user manually scrolls up, resume on `f` or `G`
- Panel focus state stored in parent component, passed as prop
- Mouse scroll would be nice-to-have but not required for v1
