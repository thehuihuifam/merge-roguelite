import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/rng/SeededRandom';

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays within [0, 1)', () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt covers the inclusive range', () => {
    const rng = new SeededRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      const v = rng.nextInt(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([3, 4, 5]));
  });

  it('reseed restarts the stream so a run can be replayed', () => {
    const rng = new SeededRandom(12345);
    const first = Array.from({ length: 5 }, () => rng.next());
    rng.reseed(12345);
    const replay = Array.from({ length: 5 }, () => rng.next());
    rng.reseed(777);
    const other = Array.from({ length: 5 }, () => rng.next());
    expect(replay).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('pick throws on empty arrays and nextInt validates bounds', () => {
    const rng = new SeededRandom(1);
    expect(() => rng.pick([])).toThrow(RangeError);
    expect(() => rng.nextInt(5, 1)).toThrow(RangeError);
  });
});
