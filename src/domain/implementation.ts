import fse from "fs-extra";
import type {
  Implementation as ImplementationData,
  SpecEntry,
  StoryPoints,
  TaskEntry,
  TaskStatusType,
} from "../types";
import { getImplementationFile } from "../utils/paths";
import { Spec } from "./spec";
import type { Task } from "./task";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter((v) => typeof v === "string");
  return strings.length === value.length ? strings : undefined;
}

function asStoryPoints(value: unknown): StoryPoints | undefined {
  return value === 1 || value === 2 || value === 3 || value === 5 || value === 8
    ? value
    : undefined;
}

function asTaskStatusType(value: unknown): TaskStatusType | undefined {
  return value === "pending" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "blocked" ||
    value === "failed"
    ? value
    : undefined;
}

function normalizeTaskEntry(
  raw: unknown,
  specId: string,
  taskIndex: number
): TaskEntry | null {
  if (!isRecord(raw)) {
    return null;
  }

  const taskId = asString(raw.id) ?? `${specId}-${taskIndex + 1}`;
  const description = asString(raw.description) ?? `Task ${taskIndex + 1}`;
  const status = asTaskStatusType(raw.status) ?? "pending";

  const task: TaskEntry = { id: taskId, description, status };

  const acceptanceCriteria = asStringArray(raw.acceptanceCriteria);
  if (acceptanceCriteria !== undefined) {
    task.acceptanceCriteria = acceptanceCriteria;
  }

  const dependsOn = asStringArray(raw.dependsOn);
  if (dependsOn !== undefined) {
    task.dependsOn = dependsOn;
  }

  const points = asStoryPoints(raw.points);
  if (points !== undefined) {
    task.points = points;
  }

  const blockedReason = asString(raw.blockedReason);
  if (blockedReason !== undefined) {
    task.blockedReason = blockedReason;
  }

  const retryCount = asNumber(raw.retryCount);
  if (retryCount !== undefined) {
    task.retryCount = retryCount;
  }

  const completedAt = asString(raw.completedAt);
  if (completedAt !== undefined) {
    task.completedAt = completedAt;
  }

  return task;
}

function normalizeSpecEntry(raw: unknown, index: number): SpecEntry | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = asString(raw.id);
  if (!id) {
    return null;
  }

  const tasksRaw = Array.isArray(raw.tasks) ? raw.tasks : [];
  const tasks: TaskEntry[] = tasksRaw
    .map((t, taskIndex) => normalizeTaskEntry(t, id, taskIndex))
    .filter((t): t is TaskEntry => t !== null);

  const spec: SpecEntry = {
    id,
    file: asString(raw.file) ?? "",
    name: asString(raw.name) ?? id,
    priority: asNumber(raw.priority) ?? index + 1,
    status: asTaskStatusType(raw.status) ?? "pending",
    tasks,
  };

  const context = asString(raw.context);
  if (context !== undefined) {
    spec.context = context;
  }

  const dependsOn = asStringArray(raw.dependsOn);
  if (dependsOn !== undefined) {
    spec.dependsOn = dependsOn;
  }

  const pointsBudget = asNumber(raw.pointsBudget);
  if (pointsBudget !== undefined) {
    spec.pointsBudget = pointsBudget;
  }

  const pointsTotal = asNumber(raw.pointsTotal);
  if (pointsTotal !== undefined) {
    spec.pointsTotal = pointsTotal;
  }

  const acceptanceCriteria = asStringArray(raw.acceptanceCriteria);
  if (acceptanceCriteria !== undefined) {
    spec.acceptanceCriteria = acceptanceCriteria;
  }

  return spec;
}

function normalizeImplementationData(raw: unknown): ImplementationData {
  const now = new Date().toISOString();
  if (!isRecord(raw)) {
    return { version: 1, updatedAt: now, updatedBy: "user", specs: [] };
  }

  const updatedByRaw = asString(raw.updatedBy);
  const updatedBy =
    updatedByRaw === "plan-mode" ||
    updatedByRaw === "build-mode" ||
    updatedByRaw === "user"
      ? updatedByRaw
      : "user";

  const specsRaw = Array.isArray(raw.specs) ? raw.specs : [];
  const specs = specsRaw
    .map((entry, index) => normalizeSpecEntry(entry, index))
    .filter((spec): spec is SpecEntry => spec !== null);

  return {
    version: asNumber(raw.version) ?? 1,
    updatedAt: asString(raw.updatedAt) ?? now,
    updatedBy,
    specs,
  };
}

export class Implementation {
  private readonly _specs: Spec[];
  private readonly _version: number;
  private _updatedAt: string;
  private _updatedBy: "plan-mode" | "build-mode" | "user";

  constructor(data: ImplementationData) {
    this._version = data.version;
    this._updatedAt = data.updatedAt;
    this._updatedBy = data.updatedBy;
    this._specs = data.specs.map((s) => Spec.fromEntry(s));
  }

  get specs(): Spec[] {
    return this._specs;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): string {
    return this._updatedAt;
  }

  get updatedBy(): "plan-mode" | "build-mode" | "user" {
    return this._updatedBy;
  }

  /**
   * Get the next pending task across all specs.
   * Finds the first pending task in the first non-completed spec.
   */
  get nextPendingTask(): { spec: Spec; task: Task } | undefined {
    const completedSpecIds = new Set(
      this._specs.filter((s) => s.isCompleted).map((s) => s.id)
    );

    const completedTaskIds = new Set<string>();
    for (const spec of this._specs) {
      for (const task of spec.tasks) {
        if (task.status === "completed") {
          completedTaskIds.add(task.id);
        }
      }
    }

    const specsByPriority = this._specs
      .map((spec, index) => ({ spec, index }))
      .sort((a, b) => {
        const priorityDelta = a.spec.priority - b.spec.priority;
        return priorityDelta !== 0 ? priorityDelta : a.index - b.index;
      })
      .map(({ spec }) => spec);

    for (const spec of specsByPriority) {
      if (spec.isCompleted) {
        continue;
      }

      if (!spec.dependenciesSatisfied(completedSpecIds)) {
        continue;
      }

      const task = spec.nextRunnablePendingTask(completedTaskIds);
      if (task) {
        return { spec, task };
      }
    }
    return undefined;
  }

  get hasPendingTasks(): boolean {
    return this._specs.some((s) => s.tasks.some((t) => t.status === "pending"));
  }

  /**
   * Get all completed specs.
   */
  get completedSpecs(): Spec[] {
    return this._specs.filter((s) => s.isCompleted);
  }

  /**
   * Get overall implementation progress.
   */
  get progress(): {
    completedSpecs: number;
    totalSpecs: number;
    completedTasks: number;
    totalTasks: number;
    percentage: number;
  } {
    const completedSpecs = this.completedSpecs.length;
    const totalSpecs = this._specs.length;

    let completedTasks = 0;
    let totalTasks = 0;

    for (const spec of this._specs) {
      const specProgress = spec.progress;
      completedTasks += specProgress.completed;
      totalTasks += specProgress.total;
    }

    const percentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      completedSpecs,
      totalSpecs,
      completedTasks,
      totalTasks,
      percentage,
    };
  }

  /**
   * Check if all specs are completed.
   */
  get isCompleted(): boolean {
    return this._specs.length > 0 && this._specs.every((s) => s.isCompleted);
  }

  /**
   * Save implementation to disk.
   */
  async save(
    updatedBy: "plan-mode" | "build-mode" | "user" = "build-mode"
  ): Promise<void> {
    this._updatedBy = updatedBy;
    this._updatedAt = new Date().toISOString();

    await fse.writeJson(getImplementationFile(), this.toJSON(), { spaces: 2 });
  }

  /**
   * Convert to plain JSON object matching the Implementation interface.
   */
  toJSON(): ImplementationData {
    return {
      version: this._version,
      updatedAt: this._updatedAt,
      updatedBy: this._updatedBy,
      specs: this._specs.map((s) => s.toJSON()),
    };
  }

  /**
   * Load implementation from disk.
   * Returns null if implementation.json doesn't exist.
   */
  static async load(): Promise<Implementation | null> {
    const implPath = getImplementationFile();

    if (!(await fse.pathExists(implPath))) {
      return null;
    }

    try {
      const content = await fse.readJson(implPath);
      return new Implementation(normalizeImplementationData(content));
    } catch {
      return null;
    }
  }

  /**
   * Create an empty implementation.
   */
  static createEmpty(): Implementation {
    return new Implementation({
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
      specs: [],
    });
  }
}
