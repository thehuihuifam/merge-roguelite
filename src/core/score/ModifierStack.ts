import type { IScoreModifier, ScoreContext } from '@/core/interfaces/IScoreModifier';

export interface ModifierStackEntry {
  readonly id: string;
  readonly multiplier: number;
  remainingMerges: number;
  remainingMs: number | null;
  readonly originalRemainingMerges: number;
  readonly originalRemainingMs: number | null;
}

export interface PushOptions {
  readonly remainingMs?: number | null;
}

function clampPositiveInt(value: number): number {
  return Math.max(1, Math.floor(value));
}

/**
 * Manages IScoreModifier instances with duration (remaining merges and/or time).
 * Used to expand multiplier cards from ad-hoc closures to a testable stack.
 *
 * - `push` adds a multiplier that lasts `remainingMerges` merges (and optionally `remainingMs`).
 * - `apply` is called by ScoreCalculator (via asModifier) to apply all active multipliers.
 * - `update` ticks time-based expiry (called each frame by Game).
 * - Detach callbacks remove a specific entry early (e.g. manual cancel).
 */
export class ModifierStack {
  private readonly entries: ModifierStackEntry[] = [];

  get activeCount(): number {
    return this.entries.length;
  }

  get all(): readonly ModifierStackEntry[] {
    return this.entries;
  }

  /**
   * Pushes a multiplier modifier that lasts `remainingMerges` merges.
   * Returns a detach function that removes it immediately.
   */
  push(id: string, multiplier: number, remainingMerges: number, remainingMs: number | null = null): () => void {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new RangeError(`ModifierStack.push: multiplier must be > 0, got ${multiplier}`);
    }
    const merges = clampPositiveInt(remainingMerges);
    let ms: number | null = null;
    if (remainingMs !== null && remainingMs !== undefined) {
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        throw new RangeError(`ModifierStack.push: remainingMs must be > 0, got ${remainingMs}`);
      }
      ms = Math.max(1, Math.floor(remainingMs));
    }
    const entry: ModifierStackEntry = {
      id,
      multiplier,
      remainingMerges: merges,
      remainingMs: ms,
      originalRemainingMerges: merges,
      originalRemainingMs: ms,
    };
    this.entries.push(entry);
    return (): void => {
      this.removeById(id);
    };
  }

  /**
   * Pushes a generic IScoreModifier with optional duration.
   * Useful for non-multiplier cards or future extensions.
   */
  pushModifier(
    modifier: IScoreModifier,
    options: { remainingMerges?: number | null; remainingMs?: number | null } = {},
  ): () => void {
    const merges = options.remainingMerges === null || options.remainingMerges === undefined ? null : clampPositiveInt(options.remainingMerges);
    let ms: number | null = null;
    if (options.remainingMs !== null && options.remainingMs !== undefined) {
      if (!Number.isFinite(options.remainingMs) || options.remainingMs <= 0) {
        throw new RangeError(`ModifierStack.pushModifier: remainingMs must be > 0`);
      }
      ms = Math.max(1, Math.floor(options.remainingMs));
    }
    // Wrap the modifier so we can track remainingMerges as a multiplier count if needed.
    // For generic case we store it as a special entry with multiplier 1 and keep the real modifier separate.
    // To keep the stack simple, we store generic modifiers as entries with multiplier NaN and keep a map.
    const genericEntry: ModifierStackEntry = {
      id: modifier.id,
      multiplier: Number.NaN,
      remainingMerges: merges ?? Number.MAX_SAFE_INTEGER,
      remainingMs: ms,
      originalRemainingMerges: merges ?? Number.MAX_SAFE_INTEGER,
      originalRemainingMs: ms,
    };
    // Store generic modifier in a parallel map.
    this.genericModifiers.set(modifier.id, modifier);
    this.entries.push(genericEntry);
    return (): void => {
      this.genericModifiers.delete(modifier.id);
      this.removeById(modifier.id);
    };
  }

  private readonly genericModifiers = new Map<string, IScoreModifier>();

  /**
   * Applies all active modifiers to `points` in insertion order.
   * Consumes one merge from each entry that has a remainingMerges counter.
   * Expired entries are removed after application.
   */
  apply(points: number, context: ScoreContext): number {
    if (this.entries.length === 0) {
      return points;
    }
    let result = points;
    const expiredIds: string[] = [];

    for (const entry of this.entries) {
      if (entry.remainingMerges <= 0) {
        expiredIds.push(entry.id);
        continue;
      }
      if (entry.remainingMs !== null && entry.remainingMs <= 0) {
        expiredIds.push(entry.id);
        continue;
      }
      const generic = this.genericModifiers.get(entry.id);
      if (generic !== undefined) {
        result = generic.modify(result, context);
      } else {
        // Multiplier path.
        if (Number.isFinite(entry.multiplier)) {
          result *= entry.multiplier;
        }
      }
      // Consume one merge if this entry is merge-limited.
      if (entry.originalRemainingMerges !== Number.MAX_SAFE_INTEGER) {
        entry.remainingMerges -= 1;
        if (entry.remainingMerges <= 0) {
          expiredIds.push(entry.id);
        }
      }
    }

    for (const id of expiredIds) {
      this.removeById(id);
    }

    return result;
  }

  /**
   * Ticks time-based expiry. Call each frame with game delta.
   */
  update(deltaMs: number): void {
    if (deltaMs <= 0 || this.entries.length === 0) {
      return;
    }
    const expired: string[] = [];
    for (const entry of this.entries) {
      if (entry.remainingMs === null) {
        continue;
      }
      entry.remainingMs -= deltaMs;
      if (entry.remainingMs <= 0) {
        expired.push(entry.id);
      }
    }
    for (const id of expired) {
      this.removeById(id);
    }
  }

  clear(): void {
    this.entries.length = 0;
    this.genericModifiers.clear();
  }

  /**
   * Returns an IScoreModifier that delegates to this stack's apply.
   * Game adds this single modifier to ScoreCalculator, and the stack manages many.
   */
  asModifier(): IScoreModifier {
    return {
      id: 'modifier-stack',
      modify: (points: number, context: ScoreContext): number => {
        return this.apply(points, context);
      },
    };
  }

  private removeById(id: string): void {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index >= 0) {
      this.entries.splice(index, 1);
    }
    this.genericModifiers.delete(id);
  }
}
