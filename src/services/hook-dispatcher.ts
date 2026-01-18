import type { HookListener, HookPayload } from "../types";

type HookName = keyof HookListener;

export class HookDispatcher {
  private readonly listeners: HookListener[] = [];

  register(listener: HookListener): void {
    this.listeners.push(listener);
  }

  async emit(hook: HookName, payload: HookPayload): Promise<void> {
    const promises = this.listeners
      .map((listener) => listener[hook]?.call(listener, payload))
      .filter(Boolean);

    await Promise.allSettled(promises);
  }
}
