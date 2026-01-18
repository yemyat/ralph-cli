import { randomUUID } from "node:crypto";
import type { AgentType, RalphSession } from "../types";

export interface CreateSessionOptions {
  mode: "plan" | "build";
  agent: AgentType;
  model?: string;
}

export class Session {
  private readonly _data: RalphSession;

  constructor(data: RalphSession) {
    this._data = { ...data };
  }

  get id(): string {
    return this._data.id;
  }

  get mode(): "plan" | "build" {
    return this._data.mode;
  }

  get status(): RalphSession["status"] {
    return this._data.status;
  }

  get pid(): number | undefined {
    return this._data.pid;
  }

  get iteration(): number {
    return this._data.iteration;
  }

  get startedAt(): string {
    return this._data.startedAt;
  }

  get agent(): AgentType {
    return this._data.agent;
  }

  get model(): string | undefined {
    return this._data.model;
  }

  get isRunning(): boolean {
    return this._data.status === "running";
  }

  setPid(pid: number): void {
    this._data.pid = pid;
  }

  markStopped(): void {
    this._data.status = "stopped";
    this._data.stoppedAt = new Date().toISOString();
  }

  markCompleted(): void {
    this._data.status = "completed";
    this._data.stoppedAt = new Date().toISOString();
  }

  markPaused(): void {
    this._data.status = "paused";
    this._data.pausedAt = new Date().toISOString();
  }

  incrementIteration(): void {
    this._data.iteration += 1;
  }

  toData(): RalphSession {
    return { ...this._data };
  }

  static create(options: CreateSessionOptions): Session {
    const sessionId = `${randomUUID().slice(0, 8)}-${options.mode}`;
    const data: RalphSession = {
      id: sessionId,
      mode: options.mode,
      status: "running",
      iteration: 0,
      startedAt: new Date().toISOString(),
      agent: options.agent,
      model: options.model,
    };
    return new Session(data);
  }

  static fromData(data: RalphSession): Session {
    return new Session(data);
  }
}
