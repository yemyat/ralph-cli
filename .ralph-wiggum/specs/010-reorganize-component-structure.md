# Reorganize Component Structure

## Overview
Restructure the flat `src/tui/` directory into a well-organized hierarchy with clear separation between layout components, content viewers, overlays, and primitives. Remove unused code (Kanban view).

## Tasks
- [ ] Create component subdirectories under `src/tui/components/`
- [ ] Move layout components (sidebar, detail-view)
- [ ] Move viewer components (spec-viewer, log-viewer, task-detail)
- [ ] Move overlay components (help-overlay, confirm-dialog)
- [ ] Move primitives (loading-spinner)
- [ ] Delete unused files (kanban.tsx, card.tsx)
- [ ] Update all imports in app.tsx
- [ ] Add barrel exports for each subdirectory
- [ ] Verify build and visual correctness

## Acceptance Criteria

### Directory Structure
- [ ] AC 1: `src/tui/components/layout/` exists with sidebar.tsx, detail-view.tsx
- [ ] AC 2: `src/tui/components/viewers/` exists with spec-viewer.tsx, log-viewer.tsx, task-detail.tsx
- [ ] AC 3: `src/tui/components/overlays/` exists with help-overlay.tsx, confirm-dialog.tsx
- [ ] AC 4: `src/tui/components/primitives/` exists with loading-spinner.tsx
- [ ] AC 5: Each subdirectory has an `index.ts` barrel export

### Dead Code Removal
- [ ] AC 6: `kanban.tsx` is deleted
- [ ] AC 7: `card.tsx` is deleted
- [ ] AC 8: No imports reference deleted files

### Import Updates
- [ ] AC 9: `app.tsx` imports from `./components/layout`, `./components/viewers`, etc.
- [ ] AC 10: All relative imports within components are updated
- [ ] AC 11: No broken imports (typecheck passes)

### Build Verification
- [ ] AC 12: `npm run typecheck` passes
- [ ] AC 13: `npm run build` succeeds
- [ ] AC 14: `npm run lint` passes (no unused imports)
- [ ] AC 15: TUI renders correctly with no visual changes

## Target File Structure

```
src/tui/
├── index.tsx                     # Entry point
├── app.tsx                       # Main orchestrator (~200 lines after hook extraction)
├── types.ts                      # Type definitions
│
├── hooks/
│   ├── index.ts                  # Barrel export
│   ├── use-keyboard-navigation.ts
│   ├── use-task-manager.ts
│   └── use-session-polling.ts
│
├── lib/
│   ├── index.ts                  # Barrel export
│   ├── constants.ts
│   ├── plan-parser.ts
│   ├── spec-parser.ts
│   └── file-operations.ts
│
└── components/
    ├── index.ts                  # Barrel export for all components
    │
    ├── layout/
    │   ├── index.ts
    │   ├── sidebar.tsx
    │   └── detail-view.tsx
    │
    ├── viewers/
    │   ├── index.ts
    │   ├── spec-viewer.tsx
    │   ├── log-viewer.tsx
    │   └── task-detail.tsx
    │
    ├── overlays/
    │   ├── index.ts
    │   ├── help-overlay.tsx
    │   └── confirm-dialog.tsx
    │
    └── primitives/
        ├── index.ts
        └── loading-spinner.tsx
```

## Implementation Details

### Barrel Exports

```typescript
// src/tui/components/layout/index.ts
export { Sidebar } from './sidebar';
export { DetailView } from './detail-view';

// src/tui/components/viewers/index.ts
export { SpecViewer } from './spec-viewer';
export { LogViewer } from './log-viewer';
export { TaskDetail } from './task-detail';

// src/tui/components/overlays/index.ts
export { HelpOverlay } from './help-overlay';
export { ConfirmDialog } from './confirm-dialog';
export type { DialogType } from './confirm-dialog';

// src/tui/components/primitives/index.ts
export { LoadingSpinner } from './loading-spinner';

// src/tui/components/index.ts
export * from './layout';
export * from './viewers';
export * from './overlays';
export * from './primitives';
```

### Updated app.tsx Imports

```typescript
// Before
import { Sidebar } from './sidebar';
import { TaskDetail } from './task-detail';
import { HelpOverlay } from './help-overlay';
import { ConfirmDialog } from './confirm-dialog';
import { LoadingSpinner } from './loading-spinner';

// After
import { Sidebar, DetailView } from './components/layout';
import { SpecViewer, LogViewer, TaskDetail } from './components/viewers';
import { HelpOverlay, ConfirmDialog } from './components/overlays';
import { LoadingSpinner } from './components/primitives';

// Or with barrel:
import {
  Sidebar,
  DetailView,
  SpecViewer,
  LogViewer,
  TaskDetail,
  HelpOverlay,
  ConfirmDialog,
  LoadingSpinner,
} from './components';
```

## Test Scenarios

```bash
#!/bin/bash
# test-component-structure.sh

set -e

echo "=== Testing Component Structure ==="

# AC 1-4: Verify directory structure exists
directories=(
  "src/tui/components/layout"
  "src/tui/components/viewers"
  "src/tui/components/overlays"
  "src/tui/components/primitives"
)

for dir in "${directories[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "FAIL: Directory $dir does not exist"
    exit 1
  fi
  echo "PASS: $dir exists"
done

# AC 5: Verify barrel exports exist
barrels=(
  "src/tui/components/layout/index.ts"
  "src/tui/components/viewers/index.ts"
  "src/tui/components/overlays/index.ts"
  "src/tui/components/primitives/index.ts"
  "src/tui/components/index.ts"
)

for barrel in "${barrels[@]}"; do
  if [ ! -f "$barrel" ]; then
    echo "FAIL: Barrel export $barrel does not exist"
    exit 1
  fi
  echo "PASS: $barrel exists"
done

# AC 6-7: Verify dead code removed
dead_files=(
  "src/tui/kanban.tsx"
  "src/tui/card.tsx"
)

for file in "${dead_files[@]}"; do
  if [ -f "$file" ]; then
    echo "FAIL: Dead code $file still exists"
    exit 1
  fi
  echo "PASS: $file removed"
done

# AC 8: Verify no imports reference deleted files
if grep -r "from.*kanban\|from.*card" src/tui/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "FAIL: Found imports referencing deleted files"
  exit 1
fi
echo "PASS: No imports reference deleted files"

# AC 12-14: Build verification
echo "Running typecheck..."
npm run typecheck
echo "PASS: typecheck"

echo "Running build..."
npm run build
echo "PASS: build"

echo "Running lint..."
npm run lint
echo "PASS: lint"

echo "=== All structure tests passed ==="
```

```typescript
// Integration test: verify imports work
// src/tui/__tests__/imports.test.ts

import { Sidebar, DetailView } from '../components/layout';
import { SpecViewer, LogViewer, TaskDetail } from '../components/viewers';
import { HelpOverlay, ConfirmDialog } from '../components/overlays';
import { LoadingSpinner } from '../components/primitives';

describe('component imports', () => {
  it('exports layout components', () => {
    expect(Sidebar).toBeDefined();
    expect(DetailView).toBeDefined();
  });

  it('exports viewer components', () => {
    expect(SpecViewer).toBeDefined();
    expect(LogViewer).toBeDefined();
    expect(TaskDetail).toBeDefined();
  });

  it('exports overlay components', () => {
    expect(HelpOverlay).toBeDefined();
    expect(ConfirmDialog).toBeDefined();
  });

  it('exports primitive components', () => {
    expect(LoadingSpinner).toBeDefined();
  });
});
```

## Migration Commands

```bash
# Create directories
mkdir -p src/tui/components/{layout,viewers,overlays,primitives}
mkdir -p src/tui/hooks
mkdir -p src/tui/lib

# Move files
mv src/tui/sidebar.tsx src/tui/components/layout/
mv src/tui/detail-view.tsx src/tui/components/layout/
mv src/tui/spec-viewer.tsx src/tui/components/viewers/
mv src/tui/log-viewer.tsx src/tui/components/viewers/
mv src/tui/task-detail.tsx src/tui/components/viewers/
mv src/tui/help-overlay.tsx src/tui/components/overlays/
mv src/tui/confirm-dialog.tsx src/tui/components/overlays/
mv src/tui/loading-spinner.tsx src/tui/components/primitives/

# Remove dead code
rm src/tui/kanban.tsx
rm src/tui/card.tsx
```

## Notes
- Barrel exports enable tree-shaking while providing clean import paths
- Consider co-locating component tests: `sidebar.tsx` → `sidebar.test.tsx`
- The `components/index.ts` re-export is optional—direct subdir imports are also clean
- Run `npm run lint -- --fix` after moves to auto-fix import sorting
