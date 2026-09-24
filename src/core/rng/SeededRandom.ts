/**
 * Deterministic PRNG (mulberry32). Seeded runs make bugs reproducible and
 * allow daily-seed modes later without touching the core.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    if (max < min) {
      throw new RangeError(`nextInt: max (${max}) must be >= min (${min})`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Picks a random element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('pick: cannot pick from an empty array');
    }
    const index = this.nextInt(0, items.length - 1);
    const item = items[index];
    if (item === undefined) {
      throw new RangeError(`pick: index ${index} out of bounds`);
    }
    return item;
  }
}

export function createSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
