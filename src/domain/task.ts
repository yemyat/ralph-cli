import type { StoryPoints, TaskEntry, TaskStatusType } from "../types";

export class Task {
  private readonly _id: string;
  private readonly _description: string;
  private _status: TaskStatusType;
  private readonly _acceptanceCriteria: string[];
  private readonly _dependsOn: string[];
  private readonly _points?: StoryPoints;
  private _blockedReason?: string;
  private _retryCount: number;
  private _completedAt?: string;

  constructor(entry: TaskEntry) {
    this._id = entry.id;
    this._description = entry.description;
    this._status = entry.status;
    this._acceptanceCriteria = entry.acceptanceCriteria ?? [];
    this._dependsOn = entry.dependsOn ?? [];
    this._points = entry.points;
    this._blockedReason = entry.blockedReason;
    this._retryCount = entry.retryCount ?? 0;
    this._completedAt = entry.completedAt;
  }

  get id(): string {
    return this._id;
  }

  get description(): string {
    return this._description;
  }

  get status(): TaskStatusType {
    return this._status;
  }

  get acceptanceCriteria(): string[] {
    return this._acceptanceCriteria;
  }

  get dependsOn(): string[] {
    return this._dependsOn;
  }

  get points(): StoryPoints | undefined {
    return this._points;
  }

  get blockedReason(): string | undefined {
    return this._blockedReason;
  }

  get retryCount(): number {
    return this._retryCount;
  }

  get completedAt(): string | undefined {
    return this._completedAt;
  }

  complete(): void {
    this._status = "completed";
    this._completedAt = new Date().toISOString();
    this._blockedReason = undefined;
  }

  block(reason: string): void {
    this._status = "blocked";
    this._blockedReason = reason;
  }

  fail(): void {
    this._status = "failed";
  }

  retry(): void {
    this._retryCount += 1;
    this._status = "pending";
    this._blockedReason = undefined;
  }

  markInProgress(): void {
    this._status = "in_progress";
    this._blockedReason = undefined;
  }

  dependenciesSatisfied(completedTaskIds: ReadonlySet<string>): boolean {
    if (this._dependsOn.length === 0) {
      return true;
    }
    return this._dependsOn.every((id) => completedTaskIds.has(id));
  }

  toJSON(): TaskEntry {
    const entry: TaskEntry = {
      id: this._id,
      description: this._description,
      status: this._status,
    };

    if (this._acceptanceCriteria.length > 0) {
      entry.acceptanceCriteria = this._acceptanceCriteria;
    }

    if (this._dependsOn.length > 0) {
      entry.dependsOn = this._dependsOn;
    }

    if (this._points !== undefined) {
      entry.points = this._points;
    }

    if (this._blockedReason !== undefined) {
      entry.blockedReason = this._blockedReason;
    }

    if (this._retryCount > 0) {
      entry.retryCount = this._retryCount;
    }

    if (this._completedAt !== undefined) {
      entry.completedAt = this._completedAt;
    }

    return entry;
  }

  static fromEntry(entry: TaskEntry): Task {
    return new Task(entry);
  }
}
