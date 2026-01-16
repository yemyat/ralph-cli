# Centralize Theme and Types

## Overview
Consolidate scattered type definitions and color constants into dedicated modules. This creates a single source of truth for the Tokyo Night theme and eliminates type duplication across TUI components.

## Tasks
- [x] Create `src/tui/types.ts` with all TUI-specific types
- [x] Create `src/tui/lib/constants.ts` with theme colors and UI constants
- [x] Move types from `utils.ts` to `types.ts`
- [x] Replace inline color hex codes with constants
- [x] Update all imports across TUI components
- [x] Verify no type/color regressions with visual inspection

## Acceptance Criteria

### Types Module
- [x] AC 1: `types.ts` exports `Task`, `TaskStatus`, `ParsedPlan` types
- [x] AC 2: `types.ts` exports `VimMode`, `DialogType`, `FocusedPanel` types
- [x] AC 3: No type definitions remain in `utils.ts` (re-exports only)
- [x] AC 4: All TUI files import types from `./types` or `../types`

### Theme Constants
- [x] AC 5: `constants.ts` exports `TOKYO_NIGHT` color palette object
- [x] AC 6: `constants.ts` exports `STATUS_ICONS` mapping
- [x] AC 7: `constants.ts` exports `TIMING` constants (debounce, polling intervals)
- [x] AC 8: No inline hex color codes in component files

### Verification (grep-based tests)
- [x] AC 9: `grep -r "#7aa2f7" src/tui/` returns only `constants.ts`
- [x] AC 10: `grep -r "#e0af68" src/tui/` returns only `constants.ts`
- [x] AC 11: `grep -r "#9ece6a" src/tui/` returns only `constants.ts`
- [x] AC 12: `grep -r "#f7768e" src/tui/` returns only `constants.ts`
- [x] AC 13: `grep -r "type Task" src/tui/` returns only `types.ts`

### Build Verification
- [x] AC 14: `bun run typecheck` passes
- [x] AC 15: `bun run build` succeeds
- [x] AC 16: TUI renders correctly with no visual changes

## File Structure

```
src/tui/
├── types.ts          # All type definitions
├── lib/
│   └── constants.ts  # Theme + UI constants
└── ...
```

## Implementation Details

### types.ts
```typescript
// src/tui/types.ts

export type TaskStatus = 'backlog' | 'in_progress' | 'completed' | 'stopped';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  specPath: string;
}

export interface ParsedPlan {
  tasks: Task[];
  planPath: string;
  rawContent: string;
}

export type VimMode = 'normal' | 'search' | 'command';

export type DialogType = 'confirm-stop' | 'force-kill' | null;

export type FocusedPanel = 'spec' | 'logs';

export interface ScrollState {
  offset: number;
  maxOffset: number;
  viewportHeight: number;
}

export interface SearchState {
  query: string;
  matches: number[];
  matchIndex: number;
}
```

### constants.ts
```typescript
// src/tui/lib/constants.ts

/**
 * Tokyo Night color palette
 * https://github.com/tokyo-night/tokyo-night-vscode-theme
 */
export const TOKYO_NIGHT = {
  // Primary
  blue: '#7aa2f7',
  purple: '#bb9af7',
  cyan: '#7dcfff',

  // Semantic
  green: '#9ece6a',   // success, completed
  yellow: '#e0af68',  // warning, in-progress
  red: '#f7768e',     // error, stopped
  orange: '#ff9e64',  // accent

  // Neutral
  fg: '#c0caf5',
  fgDark: '#a9b1d6',
  comment: '#565f89',
  bgHighlight: '#292e42',
  bg: '#1a1b26',
} as const;

export const STATUS_ICONS = {
  backlog: '○',
  in_progress: '●',
  completed: '✓',
  stopped: '■',
} as const;

export const STATUS_COLORS = {
  backlog: TOKYO_NIGHT.fgDark,
  in_progress: TOKYO_NIGHT.yellow,
  completed: TOKYO_NIGHT.green,
  stopped: TOKYO_NIGHT.red,
} as const;

export const TIMING = {
  DOUBLE_TAP_MS: 300,
  POLL_INTERVAL_MS: 2000,
  GRACEFUL_SHUTDOWN_MS: 5000,
  SPINNER_FRAME_MS: 80,
} as const;

export const LAYOUT = {
  SIDEBAR_WIDTH: 30,
  HEADER_HEIGHT: 2,
  FOOTER_HEIGHT: 2,
  MIN_CONTENT_HEIGHT: 10,
} as const;
```

## Test Scenarios

```bash
#!/bin/bash
# test-theme-centralization.sh

set -e

echo "=== Testing Theme Centralization ==="

# AC 9-12: Verify no inline colors outside constants.ts
for color in "#7aa2f7" "#e0af68" "#9ece6a" "#f7768e"; do
  matches=$(grep -r "$color" src/tui/ --include="*.ts" --include="*.tsx" | grep -v "constants.ts" | wc -l)
  if [ "$matches" -gt 0 ]; then
    echo "FAIL: Found $color outside constants.ts"
    grep -r "$color" src/tui/ --include="*.ts" --include="*.tsx" | grep -v "constants.ts"
    exit 1
  fi
  echo "PASS: $color only in constants.ts"
done

# AC 13: Verify Task type only in types.ts
task_matches=$(grep -r "^export.*type Task\|^export.*interface Task" src/tui/ --include="*.ts" | grep -v "types.ts" | wc -l)
if [ "$task_matches" -gt 0 ]; then
  echo "FAIL: Task type defined outside types.ts"
  exit 1
fi
echo "PASS: Task type only in types.ts"

# AC 14-15: Build checks
echo "Running typecheck..."
npm run typecheck
echo "PASS: typecheck"

echo "Running build..."
npm run build
echo "PASS: build"

echo "=== All tests passed ==="
```

## Notes
- Consider re-exporting types from `index.ts` for cleaner imports: `import { Task } from './tui'`
- The `as const` assertion enables type inference for object values
- Theme colors could support light mode in future by making palette configurable
- STATUS_COLORS maps status → color, useful for reducing switch statements
