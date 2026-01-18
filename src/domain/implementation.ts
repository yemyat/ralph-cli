import fse from "fs-extra";
import type { Implementation as ImplementationData } from "../types";
import { getImplementationFile } from "../utils/paths";
import { Spec } from "./spec";
import type { Task } from "./task";

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
    for (const spec of this._specs) {
      if (spec.isCompleted) {
        continue;
      }

      const task = spec.nextPendingTask;
      if (task) {
        return { spec, task };
      }
    }
    return undefined;
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
      return new Implementation(content as ImplementationData);
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
