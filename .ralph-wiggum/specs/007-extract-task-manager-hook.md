# Extract Task Manager Hook

## Overview
Extract task lifecycle and process control logic from `app.tsx` into a dedicated `useTaskManager` hook. This isolates the complex async logic for stopping tasks, handling timeouts, and managing process state.

## Tasks
- [ ] Create `use-task-manager.ts` in `src/tui/hooks/`
- [ ] Extract task stopping logic (SIGTERM → timeout → SIGKILL flow)
- [ ] Extract session polling logic into `use-session-polling.ts`
- [ ] Move confirmation dialog state management to hook
- [ ] Implement proper cleanup on unmount
- [ ] Add unit tests with mocked process control
- [ ] Wire hooks into `app.tsx`

## Acceptance Criteria

### Hook Interface
- [ ] AC 1: `useTaskManager(plan: ParsedPlan)` returns task control functions
- [ ] AC 2: Returns `{ stopTask, forceKill, stoppingTaskId, confirmState }`
- [ ] AC 3: `useSessionPolling(planPath)` returns `{ runningSession, isPolling }`

### Stop Task Flow (testable state transitions)
- [ ] AC 4: `stopTask(taskId)` sets `confirmState` to `'confirm-stop'`
- [ ] AC 5: `confirmStop()` sends SIGTERM and sets `stoppingTaskId`
- [ ] AC 6: `cancelStop()` clears `confirmState` and returns to normal
- [ ] AC 7: After 5s without exit, `confirmState` transitions to `'force-kill'`
- [ ] AC 8: `forceKill()` sends SIGKILL and clears stopping state

### Process Control (testable with mocked signals)
- [ ] AC 9: SIGTERM sent via `process.kill(pid, 'SIGTERM')`
- [ ] AC 10: SIGKILL sent via `process.kill(pid, 'SIGKILL')`
- [ ] AC 11: Process exit detected clears `stoppingTaskId`
- [ ] AC 12: Timeout ref cleaned up on unmount (no memory leaks)

### Session Polling
- [ ] AC 13: Polls session file every 2 seconds
- [ ] AC 14: Returns `runningSession` with PID when task is running
- [ ] AC 15: Returns `null` when no active session
- [ ] AC 16: Stops polling on unmount

### Error Handling
- [ ] AC 17: Handles missing PID gracefully (no crash)
- [ ] AC 18: Handles already-dead process (ESRCH error)
- [ ] AC 19: Logs errors but doesn't throw to UI

### Integration
- [ ] AC 20: `app.tsx` uses hooks instead of inline logic
- [ ] AC 21: Confirm dialogs work identically after refactor
- [ ] AC 22: Stop flow timing unchanged (5s graceful timeout)

## Test Scenarios

```typescript
// Test file: src/tui/hooks/__tests__/use-task-manager.test.ts

describe('useTaskManager', () => {
  const mockPlan: ParsedPlan = {
    tasks: [
      { id: 'task-1', title: 'Build API', status: 'in_progress', specPath: 'specs/api.md' },
    ],
    planPath: '/project/.ralph-wiggum/IMPLEMENTATION_PLAN.md',
  };

  let mockKill: jest.SpyInstance;

  beforeEach(() => {
    mockKill = jest.spyOn(process, 'kill').mockImplementation(() => true);
    jest.useFakeTimers();
  });

  afterEach(() => {
    mockKill.mockRestore();
    jest.useRealTimers();
  });

  describe('stop flow', () => {
    it('stopTask sets confirm state', () => {
      const { result } = renderHook(() => useTaskManager(mockPlan));
      act(() => result.current.stopTask('task-1'));
      expect(result.current.confirmState).toBe('confirm-stop');
    });

    it('confirmStop sends SIGTERM', () => {
      const { result } = renderHook(() => useTaskManager(mockPlan));
      // Mock running session with PID
      act(() => result.current.stopTask('task-1'));
      act(() => result.current.confirmStop(12345));
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(result.current.stoppingTaskId).toBe('task-1');
    });

    it('cancelStop clears state', () => {
      const { result } = renderHook(() => useTaskManager(mockPlan));
      act(() => result.current.stopTask('task-1'));
      act(() => result.current.cancelStop());
      expect(result.current.confirmState).toBeNull();
      expect(result.current.stoppingTaskId).toBeNull();
    });

    it('transitions to force-kill after 5s timeout', () => {
      const { result } = renderHook(() => useTaskManager(mockPlan));
      act(() => result.current.stopTask('task-1'));
      act(() => result.current.confirmStop(12345));

      act(() => jest.advanceTimersByTime(5000));

      expect(result.current.confirmState).toBe('force-kill');
    });

    it('forceKill sends SIGKILL', () => {
      const { result } = renderHook(() => useTaskManager(mockPlan));
      act(() => result.current.stopTask('task-1'));
      act(() => result.current.confirmStop(12345));
      act(() => jest.advanceTimersByTime(5000));
      act(() => result.current.forceKill(12345));

      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGKILL');
    });
  });

  describe('error handling', () => {
    it('handles ESRCH (process already dead)', () => {
      const esrchError = new Error('ESRCH');
      (esrchError as NodeJS.ErrnoException).code = 'ESRCH';
      mockKill.mockImplementation(() => { throw esrchError; });

      const { result } = renderHook(() => useTaskManager(mockPlan));
      act(() => result.current.stopTask('task-1'));

      // Should not throw, should clear stopping state
      expect(() => {
        act(() => result.current.confirmStop(12345));
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('clears timeout on unmount', () => {
      const { result, unmount } = renderHook(() => useTaskManager(mockPlan));
      act(() => result.current.stopTask('task-1'));
      act(() => result.current.confirmStop(12345));

      unmount();

      // Advance timers - should not trigger force-kill dialog
      act(() => jest.advanceTimersByTime(5000));
      // No error thrown = timeout was cleared
    });
  });
});

// Test file: src/tui/hooks/__tests__/use-session-polling.test.ts

describe('useSessionPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('polls every 2 seconds', async () => {
    const mockGetSessions = jest.fn().mockResolvedValue([]);

    renderHook(() => useSessionPolling('/project', mockGetSessions));

    expect(mockGetSessions).toHaveBeenCalledTimes(1); // initial

    act(() => jest.advanceTimersByTime(2000));
    expect(mockGetSessions).toHaveBeenCalledTimes(2);

    act(() => jest.advanceTimersByTime(2000));
    expect(mockGetSessions).toHaveBeenCalledTimes(3);
  });

  it('returns running session when found', async () => {
    const mockSession = { pid: 12345, specPath: 'specs/api.md', status: 'running' };
    const mockGetSessions = jest.fn().mockResolvedValue([mockSession]);

    const { result } = renderHook(() => useSessionPolling('/project', mockGetSessions));

    await waitFor(() => {
      expect(result.current.runningSession).toEqual(mockSession);
    });
  });

  it('stops polling on unmount', () => {
    const mockGetSessions = jest.fn().mockResolvedValue([]);
    const { unmount } = renderHook(() => useSessionPolling('/project', mockGetSessions));

    unmount();

    act(() => jest.advanceTimersByTime(4000));
    expect(mockGetSessions).toHaveBeenCalledTimes(1); // only initial call
  });
});
```

## Notes
- The 5-second timeout constant should be configurable (env var or config)
- Consider adding an `onTaskStopped` callback for parent to update plan state
- Session polling could be optimized with file watchers instead of interval
- Handle race condition: user cancels during SIGTERM → SIGKILL transition
