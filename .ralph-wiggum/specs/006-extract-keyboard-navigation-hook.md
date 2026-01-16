# Extract Keyboard Navigation Hook

## Overview
Extract the vim-style keyboard navigation logic from `app.tsx` into a dedicated `useKeyboardNavigation` hook. This reduces `app.tsx` complexity and creates a reusable, testable unit for input handling.

## Tasks
- [x] Create `src/tui/hooks/` directory
- [x] Implement `use-keyboard-navigation.ts` with mode state machine
- [x] Extract search functionality (query, matches, navigation)
- [x] Extract command mode handling
- [x] Extract double-tap detection logic (gg)
- [x] Wire hook into `app.tsx` replacing inline state
- [x] Add unit tests for hook behavior

## Acceptance Criteria

### Hook Interface
- [x] AC 1: Hook exports `useKeyboardNavigation(tasks: Task[], options: NavOptions)`
- [x] AC 2: Returns `{ mode, selectedIndex, searchState, handlers }` object
- [x] AC 3: `mode` is typed as `'normal' | 'search' | 'command'`

### Mode Transitions (testable state machine)
- [x] AC 4: Initial mode is `'normal'`
- [x] AC 5: `/` key transitions from `normal` → `search`
- [x] AC 6: `:` key transitions from `normal` → `command`
- [x] AC 7: `Escape` from any mode returns to `normal`
- [x] AC 8: `Enter` in search mode returns to `normal` (keeps selection)

### Navigation (testable with mock task list)
- [x] AC 9: `j` increments `selectedIndex` (clamped to list length - 1)
- [x] AC 10: `k` decrements `selectedIndex` (clamped to 0)
- [x] AC 11: `gg` (double-tap within 300ms) sets `selectedIndex` to 0
- [x] AC 12: `G` sets `selectedIndex` to last item
- [x] AC 13: Navigation wraps when `wrap: true` option provided

### Search (testable with mock data)
- [x] AC 14: Typing in search mode appends to `searchQuery`
- [x] AC 15: Backspace in search mode removes last character
- [x] AC 16: `searchMatches` contains indices of tasks matching query (case-insensitive)
- [x] AC 17: `n` in normal mode jumps to next match
- [x] AC 18: `N` in normal mode jumps to previous match
- [x] AC 19: Empty search clears matches array

### Integration
- [x] AC 20: `app.tsx` uses hook instead of inline useState calls
- [x] AC 21: All existing keyboard shortcuts work identically after refactor
- [x] AC 22: No visual/behavioral regression in TUI

## Notes
- Keep the hook focused on navigation state only—no process control or file I/O
- The `handlers` object should be stable (memoized) to prevent unnecessary re-renders
- Consider exposing a `reset()` function for clearing search state programmatically
- Double-tap timing (300ms) should be a constant, not hardcoded inline

## Implementation Status

**COMPLETE**

Hook:
- File: `src/tui/hooks/use-keyboard-navigation.ts`
- Tests: `src/tui/hooks/__tests__/use-keyboard-navigation.test.ts`

App Integration:
- Removed ~150 lines of inline navigation state from `app.tsx`
- Hook manages: mode, selectedIndex, searchState, commandBuffer
- App manages: selectedTask (synced from hook's selectedIndex), showHelp, stop dialogs
- App-specific keys (?, c, s/x) handled before routing to hook
