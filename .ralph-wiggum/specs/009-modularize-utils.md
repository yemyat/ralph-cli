# Modularize Utils

## Overview
Split the monolithic `utils.ts` (337 lines) into focused modules under `src/tui/lib/`. Each module handles one responsibility: plan parsing, spec parsing, or file operations.

## Tasks
- [ ] Create `src/tui/lib/` directory
- [ ] Create `plan-parser.ts` with `parseImplementationPlan()` logic
- [ ] Create `spec-parser.ts` with spec markdown parsing
- [ ] Create `file-operations.ts` with I/O functions
- [ ] Update imports across TUI components
- [ ] Delete original `utils.ts` after migration
- [ ] Verify all functionality preserved with tests

## Acceptance Criteria

### Module Structure
- [ ] AC 1: `lib/plan-parser.ts` exports `parseImplementationPlan(content: string): ParsedPlan`
- [ ] AC 2: `lib/spec-parser.ts` exports `parseSpecContent(content: string): ParsedSpec`
- [ ] AC 3: `lib/file-operations.ts` exports file I/O functions
- [ ] AC 4: Original `utils.ts` is deleted
- [ ] AC 5: No circular dependencies between modules

### Plan Parser (pure function, easily testable)
- [ ] AC 6: Parses "## In Progress" section correctly
- [ ] AC 7: Parses "## Backlog" section correctly
- [ ] AC 8: Parses "## Completed" section correctly
- [ ] AC 9: Handles stopped tasks marked with `[stopped]`
- [ ] AC 10: Extracts spec paths from markdown links
- [ ] AC 11: Returns empty arrays for missing sections

### Spec Parser (pure function, easily testable)
- [ ] AC 12: Extracts "## Overview" section
- [ ] AC 13: Extracts "## Tasks" section with checkboxes
- [ ] AC 14: Extracts "## Acceptance Criteria" section
- [ ] AC 15: Returns raw content if parsing fails

### File Operations
- [ ] AC 16: `readSpecContent(specPath)` returns spec file content
- [ ] AC 17: `readLogContent(logPath)` returns log file content
- [ ] AC 18: `markTaskAsStopped(planPath, specPath)` updates plan file
- [ ] AC 19: `appendToLog(logPath, message)` appends timestamped entry
- [ ] AC 20: All file ops handle missing files gracefully

### Build Verification
- [ ] AC 21: `npm run typecheck` passes
- [ ] AC 22: `npm run build` succeeds
- [ ] AC 23: TUI functions identically after refactor

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

## Implementation Details

### plan-parser.ts
```typescript
// src/tui/lib/plan-parser.ts
import type { Task, TaskStatus, ParsedPlan } from '../types';

const SECTION_PATTERNS = {
  inProgress: /^##\s*In\s*Progress/i,
  backlog: /^##\s*Backlog/i,
  completed: /^##\s*Completed/i,
} as const;

const TASK_LINE_PATTERN = /^-\s*(?:\[(stopped|x|\s)?\])?\s*\[([^\]]+)\]\(([^)]+)\)/;

export function parseImplementationPlan(content: string): ParsedPlan {
  const lines = content.split('\n');
  const tasks: Task[] = [];
  let currentSection: TaskStatus = 'backlog';

  for (const line of lines) {
    // Detect section changes
    if (SECTION_PATTERNS.inProgress.test(line)) {
      currentSection = 'in_progress';
      continue;
    }
    if (SECTION_PATTERNS.backlog.test(line)) {
      currentSection = 'backlog';
      continue;
    }
    if (SECTION_PATTERNS.completed.test(line)) {
      currentSection = 'completed';
      continue;
    }

    // Parse task lines
    const match = line.match(TASK_LINE_PATTERN);
    if (match) {
      const [, marker, title, specPath] = match;
      const status = marker === 'stopped' ? 'stopped'
        : marker === 'x' ? 'completed'
        : currentSection;

      tasks.push({
        id: specPath, // use specPath as stable ID
        title: formatTitle(title),
        status,
        specPath,
      });
    }
  }

  return { tasks, planPath: '', rawContent: content };
}

function formatTitle(kebabCase: string): string {
  return kebabCase
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
```

### spec-parser.ts
```typescript
// src/tui/lib/spec-parser.ts

export interface ParsedSpec {
  overview: string;
  tasks: string[];
  acceptanceCriteria: string[];
  raw: string;
}

const SECTION_HEADERS = ['## Overview', '## Tasks', '## Acceptance Criteria'];

export function parseSpecContent(content: string): ParsedSpec {
  const sections = extractSections(content);

  return {
    overview: sections['## Overview'] || '',
    tasks: parseCheckboxList(sections['## Tasks'] || ''),
    acceptanceCriteria: parseCheckboxList(sections['## Acceptance Criteria'] || ''),
    raw: content,
  };
}

function extractSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentHeader = '';
  let currentContent: string[] = [];

  for (const line of content.split('\n')) {
    if (SECTION_HEADERS.some(h => line.startsWith(h))) {
      if (currentHeader) {
        sections[currentHeader] = currentContent.join('\n').trim();
      }
      currentHeader = line;
      currentContent = [];
    } else if (currentHeader) {
      currentContent.push(line);
    }
  }

  if (currentHeader) {
    sections[currentHeader] = currentContent.join('\n').trim();
  }

  return sections;
}

function parseCheckboxList(content: string): string[] {
  return content
    .split('\n')
    .filter(line => /^-\s*\[[ x]\]/.test(line))
    .map(line => line.replace(/^-\s*\[[ x]\]\s*/, ''));
}
```

### file-operations.ts
```typescript
// src/tui/lib/file-operations.ts
import fs from 'fs-extra';
import path from 'path';

export async function readSpecContent(specPath: string): Promise<string | null> {
  try {
    return await fs.readFile(specPath, 'utf-8');
  } catch {
    return null;
  }
}

export async function readLogContent(logPath: string): Promise<string | null> {
  try {
    return await fs.readFile(logPath, 'utf-8');
  } catch {
    return null;
  }
}

export async function markTaskAsStopped(planPath: string, specPath: string): Promise<void> {
  const content = await fs.readFile(planPath, 'utf-8');
  const updated = content.replace(
    new RegExp(`^(\\s*-\\s*)\\[([^\\]]*)\\]\\(${escapeRegex(specPath)}\\)`, 'm'),
    '$1[stopped] [$2]($3)'
  );
  await fs.writeFile(planPath, updated);
}

export async function appendToLog(logPath: string, message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const entry = `\n[${timestamp}] ${message}\n`;
  await fs.appendFile(logPath, entry);
}

export async function getLatestSessionLog(sessionDir: string): Promise<string | null> {
  try {
    const files = await fs.readdir(sessionDir);
    const logs = files.filter(f => f.endsWith('.log')).sort().reverse();
    return logs[0] ? path.join(sessionDir, logs[0]) : null;
  } catch {
    return null;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

## Test Scenarios

```typescript
// src/tui/lib/__tests__/plan-parser.test.ts

describe('parseImplementationPlan', () => {
  it('parses tasks from all sections', () => {
    const content = `
# Implementation Plan

## In Progress
- [Build TUI](specs/tui.md)

## Backlog
- [Add auth](specs/auth.md)
- [stopped] [API routes](specs/api.md)

## Completed
- [x] [Setup](specs/setup.md)
`;

    const result = parseImplementationPlan(content);

    expect(result.tasks).toHaveLength(4);
    expect(result.tasks[0]).toMatchObject({ title: 'Build Tui', status: 'in_progress' });
    expect(result.tasks[1]).toMatchObject({ title: 'Add Auth', status: 'backlog' });
    expect(result.tasks[2]).toMatchObject({ title: 'Api Routes', status: 'stopped' });
    expect(result.tasks[3]).toMatchObject({ title: 'Setup', status: 'completed' });
  });

  it('handles empty sections', () => {
    const content = `
# Implementation Plan

## In Progress

## Backlog

## Completed
`;

    const result = parseImplementationPlan(content);
    expect(result.tasks).toHaveLength(0);
  });

  it('handles missing sections', () => {
    const content = `
# Implementation Plan

## Backlog
- [Task 1](specs/task1.md)
`;

    const result = parseImplementationPlan(content);
    expect(result.tasks).toHaveLength(1);
  });
});

// src/tui/lib/__tests__/spec-parser.test.ts

describe('parseSpecContent', () => {
  it('extracts all sections', () => {
    const content = `
# Feature

## Overview
This feature does X.

## Tasks
- [ ] Task 1
- [x] Task 2

## Acceptance Criteria
- [ ] AC 1
- [ ] AC 2
`;

    const result = parseSpecContent(content);

    expect(result.overview).toContain('This feature does X');
    expect(result.tasks).toEqual(['Task 1', 'Task 2']);
    expect(result.acceptanceCriteria).toEqual(['AC 1', 'AC 2']);
  });

  it('preserves raw content', () => {
    const content = '# Just a title';
    const result = parseSpecContent(content);
    expect(result.raw).toBe(content);
  });
});

// src/tui/lib/__tests__/file-operations.test.ts

describe('file operations', () => {
  const testDir = '/tmp/tui-test';

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('readSpecContent', () => {
    it('returns content for existing file', async () => {
      const specPath = path.join(testDir, 'spec.md');
      await fs.writeFile(specPath, '# Test');

      const content = await readSpecContent(specPath);
      expect(content).toBe('# Test');
    });

    it('returns null for missing file', async () => {
      const content = await readSpecContent('/nonexistent.md');
      expect(content).toBeNull();
    });
  });

  describe('appendToLog', () => {
    it('appends timestamped entry', async () => {
      const logPath = path.join(testDir, 'test.log');
      await fs.writeFile(logPath, 'existing\n');

      await appendToLog(logPath, 'new message');

      const content = await fs.readFile(logPath, 'utf-8');
      expect(content).toContain('existing');
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T.*\] new message/);
    });
  });

  describe('markTaskAsStopped', () => {
    it('marks task with stopped prefix', async () => {
      const planPath = path.join(testDir, 'plan.md');
      await fs.writeFile(planPath, '- [Build API](specs/api.md)');

      await markTaskAsStopped(planPath, 'specs/api.md');

      const content = await fs.readFile(planPath, 'utf-8');
      expect(content).toContain('[stopped]');
    });
  });
});
```

## Notes
- Pure parsing functions are easy to unit test without mocking
- File operations are isolated, making them easy to mock in component tests
- Consider adding a barrel export (`lib/index.ts`) for cleaner imports
- Regex patterns compiled at module level for performance
