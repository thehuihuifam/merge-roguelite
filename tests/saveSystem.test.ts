import { describe, expect, it } from 'vitest';
import { LocalStorageSaveSystem, SAVE_VERSION, type StorageLike } from '@/systems/LocalStorageSaveSystem';

class FakeStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  // For inspection in tests.
  raw(key: string): string | undefined {
    return this.map.get(key);
  }
}

describe('LocalStorageSaveSystem', () => {
  it('returns defaults when storage is empty', () => {
    const storage = new FakeStorage();
    const system = new LocalStorageSaveSystem(storage);
    const data = system.load();
    expect(data.bestScore).toBe(0);
    expect(data.totalRuns).toBe(0);
    expect(data.lastSeed).toBeNull();
    expect(data.version).toBe(SAVE_VERSION);
  });

  it('round-trips save and load', () => {
    const storage = new FakeStorage();
    const system = new LocalStorageSaveSystem(storage);
    system.save({ version: SAVE_VERSION, bestScore: 1234, totalRuns: 5, lastSeed: 42 });
    const loaded = system.load();
    expect(loaded.bestScore).toBe(1234);
    expect(loaded.totalRuns).toBe(5);
    expect(loaded.lastSeed).toBe(42);
  });

  it('clear removes the saved entry', () => {
    const storage = new FakeStorage();
    const system = new LocalStorageSaveSystem(storage);
    system.save({ version: SAVE_VERSION, bestScore: 10, totalRuns: 1, lastSeed: null });
    system.clear();
    expect(system.load().bestScore).toBe(0);
    expect(storage.raw('merge-roguelite:save')).toBeUndefined();
  });

  it('handles invalid JSON by returning defaults', () => {
    const storage = new FakeStorage();
    storage.setItem('merge-roguelite:save', 'not-json');
    const system = new LocalStorageSaveSystem(storage);
    const data = system.load();
    expect(data.bestScore).toBe(0);
    expect(data.totalRuns).toBe(0);
  });

  it('clamps negative scores and floors floats', () => {
    const storage = new FakeStorage();
    const system = new LocalStorageSaveSystem(storage);
    system.save({ version: SAVE_VERSION, bestScore: -5, totalRuns: 2.9, lastSeed: 1.2 });
    const loaded = system.load();
    expect(loaded.bestScore).toBe(0);
    expect(loaded.totalRuns).toBe(2);
  });

  it('preserves bestScore when version mismatches but bumps version', () => {
    const storage = new FakeStorage();
    storage.setItem('merge-roguelite:save', JSON.stringify({ version: 999, bestScore: 777, totalRuns: 3, lastSeed: 7 }));
    const system = new LocalStorageSaveSystem(storage);
    const loaded = system.load();
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.bestScore).toBe(777);
    expect(loaded.totalRuns).toBe(3);
  });

  it('ignores storage errors on save and load', () => {
    const throwingStorage: StorageLike = {
      getItem: () => {
        throw new Error('no storage');
      },
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => {
        throw new Error('no storage');
      },
    };
    const system = new LocalStorageSaveSystem(throwingStorage);
    expect(system.load().bestScore).toBe(0);
    // Should not throw.
    system.save({ version: SAVE_VERSION, bestScore: 10, totalRuns: 1, lastSeed: null });
    system.clear();
  });

  it('uses memory fallback when no storage is provided and window is absent', () => {
    const system = new LocalStorageSaveSystem(null);
    system.save({ version: SAVE_VERSION, bestScore: 50, totalRuns: 2, lastSeed: null });
    expect(system.load().bestScore).toBe(50);
  });
});
