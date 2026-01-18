# Introduce Domain Objects for Task & Spec

## Problem to solve

As a developer working with tasks and specs, I want rich domain objects with behavior, so I can write expressive code like `task.complete()` instead of `markTaskCompleted(impl, specId, taskId)`.

Current code reads like a database transaction:

```typescript
// Find, mutate, save — scattered logic
const spec = impl.specs.find((s) => s.id === specId);
const task = spec.tasks.find((t) => t.id === taskId);
task.status = "completed";
task.completedAt = new Date().toISOString();
if (spec.tasks.every((t) => t.status === "completed")) {
  spec.status = "completed";
}
await saveImplementation(projectPath, impl);
```

Rails-inspired code reads like a story:

```typescript
// Rich domain object
task.complete();
await implementation.save();
```

## Intended users

- Developers writing orchestration logic
- Developers reading business rules
- Contributors understanding "what can a task do?"

## User experience goal

A developer should be able to look at a `Task` class and immediately see all the things a task can do (complete, block, fail, retry) without searching for utility functions.

## Proposal

### Domain Model

```
src/domain/
├── implementation.ts   # Implementation class (root aggregate)
├── spec.ts             # Spec class
├── task.ts             # Task class
└── index.ts            # Exports
```

### Task Class

```typescript
// src/domain/task.ts
export class Task {
  constructor(private data: TaskEntry) {}

  get id(): string { return this.data.id; }
  get description(): string { return this.data.description; }
  get status(): TaskStatusType { return this.data.status; }
  get isCompleted(): boolean { return this.status === 'completed'; }
  get isPending(): boolean { return this.status === 'pending'; }
  get isBlocked(): boolean { return this.status === 'blocked'; }

  complete(): void {
    this.data.status = 'completed';
    this.data.completedAt = new Date().toISOString();
  }

  block(reason: string): void {
    this.data.status = 'blocked';
    this.data.blockedReason = reason;
  }

  fail(): void {
    this.data.status = 'failed';
    this.data.retryCount = (this.data.retryCount || 0) + 1;
  }

  retry(): void {
    this.data.status = 'pending';
  }

  markInProgress(): void {
    this.data.status = 'in_progress';
  }

  toJSON(): TaskEntry {
    return { ...this.data };
  }
}
```

### Spec Class

```typescript
// src/domain/spec.ts
export class Spec {
  private _tasks: Task[];

  constructor(private data: SpecEntry) {
    this._tasks = data.tasks.map(t => new Task(t));
  }

  get id(): string { return this.data.id; }
  get name(): string { return this.data.name; }
  get tasks(): Task[] { return this._tasks; }
  get isCompleted(): boolean { 
    return this._tasks.every(t => t.isCompleted); 
  }

  get nextPendingTask(): Task | null {
    return this._tasks.find(t => t.isPending) || null;
  }

  get completedTasks(): Task[] {
    return this._tasks.filter(t => t.isCompleted);
  }

  get progress(): { completed: number; total: number } {
    return {
      completed: this.completedTasks.length,
      total: this._tasks.length,
    };
  }

  checkCompletion(): void {
    if (this.isCompleted) {
      this.data.status = 'completed';
    }
  }

  toJSON(): SpecEntry {
    return {
      ...this.data,
      tasks: this._tasks.map(t => t.toJSON()),
    };
  }
}
```

### Implementation Class

```typescript
// src/domain/implementation.ts
export class Implementation {
  private _specs: Spec[];

  constructor(
    private data: ImplementationData,
    private projectPath: string
  ) {
    this._specs = data.specs.map(s => new Spec(s));
  }

  static async load(projectPath: string): Promise<Implementation | null> {
    const data = await parseImplementation(projectPath);
    return data ? new Implementation(data, projectPath) : null;
  }

  get specs(): Spec[] { return this._specs; }

  get nextPendingTask(): { spec: Spec; task: Task } | null {
    for (const spec of this._specs) {
      if (spec.isCompleted) continue;
      const task = spec.nextPendingTask;
      if (task) return { spec, task };
    }
    return null;
  }

  async save(): Promise<void> {
    const data = this.toJSON();
    await saveImplementation(this.projectPath, data);
  }

  toJSON(): ImplementationData {
    return {
      ...this.data,
      specs: this._specs.map(s => s.toJSON()),
      updatedAt: new Date().toISOString(),
    };
  }
}
```

### Usage in Orchestration

```typescript
// Before: procedural style
const impl = await parseImplementation(projectPath);
const next = getNextPendingTask(impl);
if (!next) return;

markTaskInProgress(impl, next.spec.id, next.task.id);
await saveImplementation(projectPath, impl);

// ... later
markTaskCompleted(impl, next.spec.id, next.task.id);
await saveImplementation(projectPath, impl);

// After: domain object style
const impl = await Implementation.load(projectPath);
const next = impl.nextPendingTask;
if (!next) return;

next.task.markInProgress();
await impl.save();

// ... later
next.task.complete();
next.spec.checkCompletion();
await impl.save();
```

## Tasks

- [ ] Create `src/domain/` directory
- [ ] Create `src/domain/task.ts` with `Task` class
- [ ] Create `src/domain/spec.ts` with `Spec` class
- [ ] Create `src/domain/implementation.ts` with `Implementation` class
- [ ] Create `src/domain/index.ts` with exports
- [ ] Add unit tests for `Task` class (5 cases)
- [ ] Add unit tests for `Spec` class (5 cases)
- [ ] Add unit tests for `Implementation` class (5 cases)
- [ ] Update `orchestration/task-loop.ts` to use domain objects
- [ ] Update `orchestration/task-handlers.ts` to use domain objects
- [ ] Keep `utils/implementation.ts` for backward compatibility (deprecate later)
- [ ] Update existing tests to verify domain objects work
- [ ] Run full test suite

## Acceptance Criteria

- [ ] Given I have a `Task` instance, when I call `task.complete()`, then status is 'completed' and completedAt is set
- [ ] Given I have a `Spec` instance, when all tasks are completed, then `spec.isCompleted` returns true
- [ ] Given I have an `Implementation` instance, when I call `impl.nextPendingTask`, then it returns the first pending task
- [ ] Given I call `impl.save()`, when I reload the implementation, then changes are persisted
- [ ] Given I run `bun test`, when tests complete, then all tests pass including new domain tests

## Success Metrics

- Domain objects encapsulate all task/spec behavior
- Zero direct mutation of `TaskEntry` outside domain classes
- Code reads more expressively ("task.complete()" vs "markTaskCompleted(impl, specId, taskId)")
- 15+ new unit tests for domain layer

## Testing Requirements

- [ ] Unit tests for `Task` class methods
- [ ] Unit tests for `Spec` class methods
- [ ] Unit tests for `Implementation` class methods
- [ ] Integration test: load → modify → save → reload → verify

## Notes

### Migration Strategy

1. **Phase 1**: Add domain objects alongside existing utilities
2. **Phase 2**: Update orchestration to use domain objects
3. **Phase 3**: Deprecate utility functions
4. **Phase 4**: Remove utility functions

This allows gradual migration without breaking existing code.

### Why Not Active Record Pattern?

We're not using a database, so Active Record (where objects know how to save themselves) is overkill. Instead:

- Domain objects are pure (no I/O in Task/Spec)
- Only `Implementation` knows about persistence
- This keeps Task/Spec easy to test

### Immutability Consideration

For extra safety, consider making domain objects immutable:

```typescript
complete(): Task {
  return new Task({
    ...this.data,
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
}
```

This prevents accidental mutations but adds complexity. Start mutable, refactor if needed.
