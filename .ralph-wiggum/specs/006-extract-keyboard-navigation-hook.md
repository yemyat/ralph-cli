# Extract Keyboard Navigation Hook

## Overview
Extract the vim-style keyboard navigation logic from `app.tsx` into a dedicated `useKeyboardNavigation` hook. This reduces `app.tsx` complexity and creates a reusable, testable unit for input handling.

## Tasks
- [ ] Create `src/tui/hooks/` directory
- [ ] Implement `use-keyboard-navigation.ts` with mode state machine
- [ ] Extract search functionality (query, matches, navigation)
- [ ] Extract command mode handling
- [ ] Extract double-tap detection logic (gg)
- [ ] Wire hook into `app.tsx` replacing inline state
- [ ] Add unit tests for hook behavior

## Acceptance Criteria

### Hook Interface
- [ ] AC 1: Hook exports `useKeyboardNavigation(tasks: Task[], options: NavOptions)`
- [ ] AC 2: Returns `{ mode, selectedIndex, searchState, handlers }` object
- [ ] AC 3: `mode` is typed as `'normal' | 'search' | 'command'`

### Mode Transitions (testable state machine)
- [ ] AC 4: Initial mode is `'normal'`
- [ ] AC 5: `/` key transitions from `normal` → `search`
- [ ] AC 6: `:` key transitions from `normal` → `command`
- [ ] AC 7: `Escape` from any mode returns to `normal`
- [ ] AC 8: `Enter` in search mode returns to `normal` (keeps selection)

### Navigation (testable with mock task list)
- [ ] AC 9: `j` increments `selectedIndex` (clamped to list length - 1)
- [ ] AC 10: `k` decrements `selectedIndex` (clamped to 0)
- [ ] AC 11: `gg` (double-tap within 300ms) sets `selectedIndex` to 0
- [ ] AC 12: `G` sets `selectedIndex` to last item
- [ ] AC 13: Navigation wraps when `wrap: true` option provided

### Search (testable with mock data)
- [ ] AC 14: Typing in search mode appends to `searchQuery`
- [ ] AC 15: Backspace in search mode removes last character
- [ ] AC 16: `searchMatches` contains indices of tasks matching query (case-insensitive)
- [ ] AC 17: `n` in normal mode jumps to next match
- [ ] AC 18: `N` in normal mode jumps to previous match
- [ ] AC 19: Empty search clears matches array

### Integration
- [ ] AC 20: `app.tsx` uses hook instead of inline useState calls
- [ ] AC 21: All existing keyboard shortcuts work identically after refactor
- [ ] AC 22: No visual/behavioral regression in TUI

## Test Scenarios

```typescript
// Test file: src/tui/hooks/__tests__/use-keyboard-navigation.test.ts

describe('useKeyboardNavigation', () => {
  const mockTasks: Task[] = [
    { id: '1', title: 'Setup auth', status: 'backlog', specPath: 'specs/auth.md' },
    { id: '2', title: 'Build API', status: 'in_progress', specPath: 'specs/api.md' },
    { id: '3', title: 'Add tests', status: 'backlog', specPath: 'specs/tests.md' },
  ];

  describe('mode transitions', () => {
    it('starts in normal mode', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      expect(result.current.mode).toBe('normal');
    });

    it('/ transitions to search mode', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      act(() => result.current.handlers.handleKey('/'));
      expect(result.current.mode).toBe('search');
    });

    it('Escape returns to normal from search', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      act(() => result.current.handlers.handleKey('/'));
      act(() => result.current.handlers.handleKey('Escape'));
      expect(result.current.mode).toBe('normal');
    });
  });

  describe('navigation', () => {
    it('j moves selection down', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      expect(result.current.selectedIndex).toBe(0);
      act(() => result.current.handlers.handleKey('j'));
      expect(result.current.selectedIndex).toBe(1);
    });

    it('k moves selection up', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      act(() => result.current.handlers.handleKey('j')); // go to 1
      act(() => result.current.handlers.handleKey('k')); // back to 0
      expect(result.current.selectedIndex).toBe(0);
    });

    it('clamps at boundaries', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      act(() => result.current.handlers.handleKey('k')); // try to go below 0
      expect(result.current.selectedIndex).toBe(0);
    });

    it('G jumps to last item', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      act(() => result.current.handlers.handleKey('G'));
      expect(result.current.selectedIndex).toBe(2);
    });

    it('gg double-tap jumps to first item', async () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      act(() => result.current.handlers.handleKey('G')); // go to end
      act(() => result.current.handlers.handleKey('g'));
      act(() => result.current.handlers.handleKey('g')); // within 300ms
      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('search', () => {
    it('builds search query in search mode', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      act(() => result.current.handlers.handleKey('/'));
      act(() => result.current.handlers.handleKey('a'));
      act(() => result.current.handlers.handleKey('p'));
      act(() => result.current.handlers.handleKey('i'));
      expect(result.current.searchState.query).toBe('api');
    });

    it('finds matching tasks case-insensitively', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      act(() => result.current.handlers.handleKey('/'));
      act(() => result.current.handlers.handleKey('A'));
      act(() => result.current.handlers.handleKey('P'));
      act(() => result.current.handlers.handleKey('I'));
      expect(result.current.searchState.matches).toContain(1); // 'Build API'
    });

    it('n jumps to next match', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockTasks));
      // Search for 'a' which matches 'Setup auth' and 'Add tests'
      act(() => result.current.handlers.handleKey('/'));
      act(() => result.current.handlers.handleKey('a'));
      act(() => result.current.handlers.handleKey('Enter'));
      act(() => result.current.handlers.handleKey('n'));
      expect(result.current.searchState.matchIndex).toBe(1);
    });
  });
});
```

## Notes
- Keep the hook focused on navigation state only—no process control or file I/O
- The `handlers` object should be stable (memoized) to prevent unnecessary re-renders
- Consider exposing a `reset()` function for clearing search state programmatically
- Double-tap timing (300ms) should be a constant, not hardcoded inline
