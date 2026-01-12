# Ralph CLI Test Suite Specification

## Overview
Create a comprehensive test suite for the Ralph CLI tool using Bun's built-in test runner.

## Requirements

### Test Structure
- [ ] Create `src/__tests__/` directory for test files
- [ ] Use Bun's built-in test runner (`bun test`)
- [ ] Follow naming convention: `*.test.ts`

### Unit Tests Required

#### 1. Config Module (`src/config.ts`)
- [ ] Test `initProject()` creates correct config structure
- [ ] Test `getProjectConfig()` returns null for uninitialized projects
- [ ] Test `getProjectConfig()` returns config for initialized projects
- [ ] Test `saveSession()` and `getProjectSessions()` work correctly

#### 2. Agent Implementations (`src/agents/`)
- [ ] Test `checkInstalled()` for each agent (claude, amp, droid)
- [ ] Test `buildCommand()` generates correct CLI args
- [ ] Test agent registry `getAgent()` and `getAllAgents()`

#### 3. Path Utilities (`src/utils/paths.ts`)
- [ ] Test `getProjectId()` generates consistent IDs
- [ ] Test `getSessionLogFile()` returns correct paths
- [ ] Test path utilities handle edge cases

#### 4. Template Generation (`src/templates/prompts.ts`)
- [ ] Verify template constants are non-empty strings
- [ ] Test templates contain expected sections

### Integration Tests (Optional)
- [ ] Test `ralph init` creates expected file structure
- [ ] Test `ralph status` shows correct information

## Acceptance Criteria
- All tests pass with `bun test`
- Tests are isolated and don't modify real config files
- Use temp directories for filesystem tests
- No external dependencies required for tests

## Technical Notes
- Bun test docs: https://bun.sh/docs/cli/test
- Use `describe()`, `it()`, `expect()` from bun:test
- Mock filesystem operations where needed
