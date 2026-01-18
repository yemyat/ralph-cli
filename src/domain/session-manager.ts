import type { RalphSession } from "../types";
import { Session } from "./session";

export class SessionManager {
  private _sessions: Session[];

  constructor(sessionsData: RalphSession[]) {
    this._sessions = sessionsData.map((s) => Session.fromData(s));
  }

  get all(): Session[] {
    return [...this._sessions];
  }

  get running(): Session[] {
    return this._sessions.filter((s) => s.isRunning);
  }

  find(sessionId: string): Session | undefined {
    return this._sessions.find((s) => s.id === sessionId);
  }

  add(session: Session): void {
    const idx = this._sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      this._sessions[idx] = session;
    } else {
      this._sessions.push(session);
    }
  }

  update(session: Session): void {
    this.add(session);
  }

  remove(sessionId: string): void {
    this._sessions = this._sessions.filter((s) => s.id !== sessionId);
  }

  toData(): RalphSession[] {
    return this._sessions.map((s) => s.toData());
  }
}
