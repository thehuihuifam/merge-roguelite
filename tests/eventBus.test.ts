import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/events/EventBus';

interface TestEvents {
  ping: { value: number };
  done: Record<string, never>;
}

describe('EventBus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('ping', listener);
    bus.emit('ping', { value: 3 });
    expect(listener).toHaveBeenCalledWith({ value: 3 });
  });

  it('unsubscribes via the returned disposer and off()', () => {
    const bus = new EventBus<TestEvents>();
    const first = vi.fn();
    const second = vi.fn();
    const dispose = bus.on('ping', first);
    bus.on('ping', second);
    dispose();
    bus.off('ping', second);
    bus.emit('ping', { value: 1 });
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('once() fires exactly one time', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.once('done', listener);
    bus.emit('done', {});
    bus.emit('done', {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tolerates listeners removed during emit', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const first = vi.fn(() => {
      bus.off('ping', second);
    });
    bus.on('ping', first);
    bus.on('ping', second);
    expect(() => bus.emit('ping', { value: 0 })).not.toThrow();
    expect(first).toHaveBeenCalledTimes(1);
  });
});
