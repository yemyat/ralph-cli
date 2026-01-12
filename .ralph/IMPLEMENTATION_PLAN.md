# Implementation Plan

## Current Status
- [x] Core CLI implementation complete
- [x] All commands implemented (init, start, stop, status, list, logs, agents)
- [x] Agent implementations complete (Claude, Amp, Droid)
- [x] Configuration and session management working
- [x] Test suite implemented (per testing.md spec) - 52 tests passing
- [x] Ultracite/Biome linting integration (per ultracite.md spec) - COMPLETE

## Tasks (Priority Order)

### Medium Priority

#### Integration Tests (Optional per testing.md spec)
- [ ] Test `ralph init` creates expected file structure
- [ ] Test `ralph status` shows correct information

### Low Priority

#### Documentation Improvements
- [ ] Update example.md spec with actual project-specific content
- [ ] Consider creating src/lib/ for shared utilities if needed (currently not required - utilities are in src/utils/)

## Completed

### Ultracite/Biome Integration ✅ (2026-01-12)
- [x] Installed Ultracite with Biome via `npx ultracite init --linter biome --pm bun --quiet`
- [x] Verified biome.jsonc created with Ultracite config
- [x] Added devDependencies: `@biomejs/biome` and `ultracite`
- [x] Added npm scripts: `lint`, `lint:fix`, `format`
- [x] Fixed all lint issues:
  - Updated Node.js imports to use `node:` protocol
  - Removed async from sync functions returning Promise.resolve()
  - Fixed barrel file exports with biome-ignore comment
  - Replaced nested ternary with helper function in status.ts
  - Fixed implicit any type in logs.ts
  - Moved regex literals to top level in paths.test.ts
- [x] All checks pass: `bun run lint`, `bun run typecheck`, `bun test` (52 tests)

### Cleanup ✅ (2026-01-12)
- [x] Removed stale empty `specs/` directory at project root

### Test Suite ✅ (2026-01-12)
- [x] Created `src/__tests__/` directory structure
- [x] Config Module Tests (`src/__tests__/config.test.ts`)
  - Tests for `initProject()`, `getProjectConfig()`, session management
  - Verifies config doesn't create redundant specs directory (bug fix verified)
- [x] Agent Tests (`src/__tests__/agents.test.ts`)
  - Tests for `checkInstalled()`, `buildCommand()` for all agents (claude, amp, droid)
  - Tests for agent registry `getAgent()` and `getAllAgents()`
- [x] Path Utilities Tests (`src/__tests__/paths.test.ts`)
  - Tests for `getProjectId()` consistency and edge cases
  - Tests for `getSessionLogFile()` path generation
- [x] Template Tests (`src/__tests__/templates.test.ts`)
  - Verifies template constants are non-empty
  - Tests templates contain expected sections

### Bug Fixes ✅ (2026-01-12)
- [x] Removed redundant `specs/` directory creation in `config.ts`
  - `initProject()` was incorrectly creating `join(projectPath, "specs")` at project root
  - `init.ts` correctly creates `.ralph/specs/` - config.ts code was redundant

### TypeScript Configuration ✅ (2026-01-12)
- [x] Added `@types/bun` for test type support
- [x] Updated `tsconfig.json` with `"types": ["bun", "node"]`

### Core Implementation ✅
- [x] CLI entry point with Commander.js (`src/index.ts`)
- [x] TypeScript types (`src/types.ts`)
- [x] Configuration management (`src/config.ts`)
- [x] Path utilities (`src/utils/paths.ts`)
- [x] Prompt templates (`src/templates/prompts.ts`)

### Commands ✅
- [x] `ralph init` - Initialize project
- [x] `ralph start [plan|build]` - Start the Ralph loop
- [x] `ralph stop` - Stop running session
- [x] `ralph status` - Show project status
- [x] `ralph list` - List all projects
- [x] `ralph logs` - View session logs
- [x] `ralph agents` - List available agents

### Agent Implementations ✅
- [x] BaseAgent abstract class
- [x] ClaudeAgent - Claude Code integration
- [x] AmpAgent - Amp Code integration
- [x] DroidAgent - Factory Droid integration
- [x] Agent registry with getAgent() and getAllAgents()

### Project Files ✅
- [x] .ralph/PROMPT_plan.md template
- [x] .ralph/PROMPT_build.md template
- [x] .ralph/AGENTS.md template
- [x] .ralph/IMPLEMENTATION_PLAN.md template
- [x] .ralph/specs/ directory with example.md

## Discovered Issues

### Resolved: Issue #1 - Stale empty `specs/` directory at project root
- **Location:** `/Users/yemyat/src/tries/2026-01-12-ralph-cli/specs/`
- **Status:** RESOLVED (2026-01-12)
- **Description:** Empty directory leftover from the old redundant specs creation bug
- **Resolution:** Removed the empty directory with `rmdir specs`

### Resolved: Bug #1 - Redundant specs directory
- **Location:** `src/config.ts:72-73` (removed)
- **Resolution:** Removed lines that created `specs/` at project root since `init.ts` correctly creates `.ralph/specs/`
