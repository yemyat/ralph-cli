# Add Unit Tests for Init Command

## Problem to solve

As a maintainer, I want tests for the `init` command, so I can refactor the 322-line file with confidence and ensure edge cases are handled correctly.

Currently, `commands/init.ts` has zero test coverage despite being:
- User's first interaction with the CLI
- Complex interactive flow with multiple prompts
- File creation logic that could fail silently

## Intended users

- Developers modifying the init flow
- CI pipeline validating init behavior
- Contributors understanding init requirements

## User experience goal

A developer should be able to modify `init.ts` and know immediately if they broke:
- Agent selection logic
- File creation
- Config persistence
- Telegram setup flow

## Proposal

### Test Strategy

The init command has two testable layers:

**1. Pure Functions (Easy to Test)**
- `addLogsToGitignore()` — file manipulation
- `ensureFile()` — conditional file creation
- `createProjectFiles()` — directory/file setup
- `checkAgentInstalled()` — agent validation

**2. Interactive Flow (Harder to Test)**
- `promptForTelegramConfig()` — user prompts
- `selectAgent()` — selection UI
- `initCommand()` — full orchestration

### Approach: Extract and Test Pure Logic

Move testable logic out of the interactive wrapper:

```typescript
// commands/init.ts — thin wrapper
export async function initCommand(options: InitOptions): Promise<void> {
  // Interactive prompts here
  const planAgent = await selectAgentIfNeeded(options);
  const buildAgent = await selectAgentIfNeeded(options);
  
  // Delegate to testable function
  await initializeProject(projectPath, { planAgent, buildAgent, ...options });
}

// commands/init-logic.ts — testable core
export async function initializeProject(
  projectPath: string,
  options: ResolvedInitOptions
): Promise<InitResult> {
  // All file operations, no prompts
}
```

### Test Cases

**`init-logic.test.ts`** (new file)

1. **Config Creation**
   - Creates `.ralph-wiggum/config.json` with correct structure
   - Sets correct agent types for plan/build
   - Includes model when provided
   - Includes telegram config when provided

2. **File Creation**
   - Creates `PROMPT_plan.md`
   - Creates `GUARDRAILS.md`
   - Creates `PROGRESS.md`
   - Creates `implementation.json` with default quality gates
   - Creates `specs/example.md` when specs dir is empty
   - Does NOT overwrite existing files

3. **Gitignore**
   - Adds logs pattern to existing `.gitignore`
   - Creates `.gitignore` if missing
   - Does not duplicate pattern if already present

4. **Agent Validation**
   - Returns error when plan agent not installed
   - Returns error when build agent not installed
   - Proceeds when both agents installed

5. **Idempotency**
   - Running init twice doesn't corrupt config
   - Running init with `--force` overwrites config
   - Running init without `--force` on existing project shows warning

## Tasks

- [ ] Create `src/commands/__tests__/` directory
- [ ] Create `init-logic.test.ts` test file
- [ ] Extract `initializeProject()` from `initCommand()`
- [ ] Extract `addLogsToGitignore()` to be testable (accept path param)
- [ ] Extract `createProjectFiles()` to be testable
- [ ] Add tests for config creation (4 cases)
- [ ] Add tests for file creation (6 cases)
- [ ] Add tests for gitignore handling (3 cases)
- [ ] Add tests for agent validation (3 cases)
- [ ] Add tests for idempotency (3 cases)
- [ ] Add test fixtures for mock agent responses
- [ ] Ensure tests use temp directories
- [ ] Verify all tests clean up after themselves

## Acceptance Criteria

- [ ] Given I run `bun test src/commands/`, when tests complete, then at least 15 init tests pass
- [ ] Given I run init on a new project, when I check `.ralph-wiggum/`, then all expected files exist
- [ ] Given I run init on existing project without `--force`, when command completes, then existing config is preserved
- [ ] Given I run init with uninstalled agent, when command runs, then it shows install instructions
- [ ] Given I run `bun test`, when tests complete, then total passes 225+ tests

## Success Metrics

- 15+ unit tests for init command
- All file creation logic has test coverage
- Edge cases (existing files, missing agents) are tested
- Tests run in temp directories, no pollution

## Testing Requirements

- [ ] Tests use `bun:test` runner
- [ ] Tests create temp directories with `mkdtemp()`
- [ ] Tests clean up temp directories in `afterEach`
- [ ] Tests mock agent `checkInstalled()` responses
- [ ] Tests do NOT mock filesystem (test real file operations)

## Notes

### Test File Structure

```typescript
// src/commands/__tests__/init-logic.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeProject } from '../init-logic';

describe('initializeProject', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'ralph-init-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('config creation', () => {
    it('creates config.json with plan and build agents', async () => {
      await initializeProject(testDir, {
        planAgent: 'claude',
        buildAgent: 'amp',
      });

      const config = await readJson(join(testDir, '.ralph-wiggum/config.json'));
      expect(config.agents.plan.agent).toBe('claude');
      expect(config.agents.build.agent).toBe('amp');
    });
  });
});
```

### Mocking Agent Installation

```typescript
// Mock specific agent as installed/not installed
import { ClaudeAgent } from '../../agents/claude';

describe('agent validation', () => {
  it('fails when plan agent not installed', async () => {
    // Temporarily mock checkInstalled
    const original = ClaudeAgent.prototype.checkInstalled;
    ClaudeAgent.prototype.checkInstalled = async () => false;

    const result = await initializeProject(testDir, { planAgent: 'claude' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('not installed');

    // Restore
    ClaudeAgent.prototype.checkInstalled = original;
  });
});
```

### What NOT to Test

- Interactive prompt UI (tested manually)
- `@clack/prompts` library behavior
- Actual agent installation status on CI
