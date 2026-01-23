import type { SpecEntry } from "../types";
import { Task } from "./task";

export class Spec {
  private readonly _id: string;
  private readonly _file: string;
  private readonly _name: string;
  private readonly _priority: number;
  private readonly _context?: string;
  private readonly _pointsBudget?: number;
  private readonly _dependsOn: string[];
  private readonly _tasks: Task[];
  private readonly _acceptanceCriteria: string[];

  constructor(entry: SpecEntry) {
    this._id = entry.id;
    this._file = entry.file;
    this._name = entry.name;
    this._priority = entry.priority;
    this._context = entry.context;
    this._pointsBudget = entry.pointsBudget;
    this._dependsOn = entry.dependsOn ?? [];
    this._tasks = entry.tasks.map((t) => Task.fromEntry(t));
    this._acceptanceCriteria = entry.acceptanceCriteria ?? [];
  }

  get id(): string {
    return this._id;
  }

  get file(): string {
    return this._file;
  }

  get name(): string {
    return this._name;
  }

  get priority(): number {
    return this._priority;
  }

  get context(): string | undefined {
    return this._context;
  }

  get pointsBudget(): number | undefined {
    return this._pointsBudget;
  }

  get dependsOn(): string[] {
    return this._dependsOn;
  }

  get tasks(): Task[] {
    return this._tasks;
  }

  get acceptanceCriteria(): string[] {
    return this._acceptanceCriteria;
  }

  get isCompleted(): boolean {
    return (
      this._tasks.length > 0 &&
      this._tasks.every((t) => t.status === "completed")
    );
  }

  get nextPendingTask(): Task | undefined {
    const completedTaskIds = new Set(
      this._tasks.filter((t) => t.status === "completed").map((t) => t.id)
    );

    return this._tasks.find((t) => {
      if (t.status !== "pending") {
        return false;
      }
      if (t.dependsOn.length === 0) {
        return true;
      }
      return t.dependsOn.every((depId) => completedTaskIds.has(depId));
    });
  }

  get completedTasks(): Task[] {
    return this._tasks.filter((t) => t.status === "completed");
  }

  get progress(): { completed: number; total: number; percentage: number } {
    const total = this._tasks.length;
    const completed = this.completedTasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  }

  /**
   * Checks if all tasks are completed and returns the completion status.
   * Does not mutate state - just reports current completion status.
   */
  checkCompletion(): {
    isComplete: boolean;
    pendingCount: number;
    blockedCount: number;
  } {
    const pendingCount = this._tasks.filter(
      (t) => t.status === "pending"
    ).length;
    const blockedCount = this._tasks.filter(
      (t) => t.status === "blocked"
    ).length;
    return {
      isComplete: this.isCompleted,
      pendingCount,
      blockedCount,
    };
  }

  toJSON(): SpecEntry {
    const entry: SpecEntry = {
      id: this._id,
      file: this._file,
      name: this._name,
      priority: this._priority,
      status: this.isCompleted ? "completed" : "pending",
      tasks: this._tasks.map((t) => t.toJSON()),
    };

    if (this._context !== undefined) {
      entry.context = this._context;
    }

    if (this._pointsBudget !== undefined) {
      entry.pointsBudget = this._pointsBudget;
    }

    if (this._dependsOn.length > 0) {
      entry.dependsOn = this._dependsOn;
    }

    if (this._acceptanceCriteria.length > 0) {
      entry.acceptanceCriteria = this._acceptanceCriteria;
    }

    return entry;
  }

  static fromEntry(entry: SpecEntry): Spec {
    return new Spec(entry);
  }
}
