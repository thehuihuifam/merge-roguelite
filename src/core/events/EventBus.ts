export type Listener<T> = (payload: T) => void;

/**
 * Minimal strongly-typed publish/subscribe bus.
 * Extension systems (audio, particles, save, ...) subscribe here instead of
 * being called directly by the core loop.
 */
export class EventBus<EventMap extends object> {
  private readonly listeners = new Map<keyof EventMap, Set<Listener<never>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return (): void => {
      this.off(event, listener);
    };
  }

  once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    const wrapped: Listener<EventMap[K]> = (payload) => {
      this.off(event, wrapped);
      listener(payload);
    };
    return this.on(event, wrapped);
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set === undefined) {
      return;
    }
    set.delete(listener as Listener<never>);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (set === undefined) {
      return;
    }
    for (const listener of Array.from(set)) {
      (listener as Listener<EventMap[K]>)(payload);
    }
  }

  listenerCount(event: keyof EventMap): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}
