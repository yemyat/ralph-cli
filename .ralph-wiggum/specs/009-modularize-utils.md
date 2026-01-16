# Modularize Utils

## Overview
Split the monolithic `utils.ts` (337 lines) into focused modules under `src/tui/lib/`. Each module handles one responsibility: plan parsing, spec parsing, or file operations.

## Tasks
- [x] Create `src/tui/lib/` directory
- [x] Create `plan-parser.ts` with `parseImplementationPlan()` logic
- [x] Create `spec-parser.ts` with spec markdown parsing
- [x] Create `file-operations.ts` with I/O functions
- [x] Update imports across TUI components
- [x] Delete original `utils.ts` after migration
- [x] Verify all functionality preserved with tests

## Acceptance Criteria

### Module Structure
- [x] AC 1: `lib/plan-parser.ts` exports `parseImplementationPlanContent(content: string): ParsedPlan`
- [x] AC 2: `lib/spec-parser.ts` exports `parseSpecContent(content: string): ParsedSpec`
- [x] AC 3: `lib/file-operations.ts` exports file I/O functions
- [x] AC 4: Original `utils.ts` is deleted
- [x] AC 5: No circular dependencies between modules

### Plan Parser (pure function, easily testable)
- [x] AC 6: Parses "## In Progress" section correctly
- [x] AC 7: Parses "## Backlog" section correctly
- [x] AC 8: Parses "## Completed" section correctly
- [x] AC 9: Handles stopped tasks marked with `[stopped]`
- [x] AC 10: Extracts spec paths from markdown links
- [x] AC 11: Returns empty arrays for missing sections

### Spec Parser (pure function, easily testable)
- [x] AC 12: Extracts "## Overview" section
- [x] AC 13: Extracts "## Tasks" section with checkboxes
- [x] AC 14: Extracts "## Acceptance Criteria" section
- [x] AC 15: Returns raw content if parsing fails

### File Operations
- [x] AC 16: `readSpecContent(specPath)` returns spec file content
- [x] AC 17: `readLogContent(logPath)` returns log file content
- [x] AC 18: `markTaskAsStopped(planPath, specPath)` updates plan file
- [x] AC 19: `appendToLog(logPath, message)` appends timestamped entry
- [x] AC 20: All file ops handle missing files gracefully

### Build Verification
- [x] AC 21: `bun run typecheck` passes
- [x] AC 22: `bun run build` succeeds
- [x] AC 23: TUI functions identically after refactor

## File Structure

```
src/tui/
├── lib/
│   ├── constants.ts      # (from spec 008)
│   ├── plan-parser.ts    # IMPLEMENTATION_PLAN.md parsing
│   ├── spec-parser.ts    # Spec markdown parsing
│   └── file-operations.ts # File I/O utilities
├── types.ts              # (from spec 008)
└── ...
```

## Notes
- Pure parsing functions are easy to unit test without mocking
- File operations are isolated, making them easy to mock in component tests
- Regex patterns compiled at module level for performance
- 24 new tests added for the modularized code
