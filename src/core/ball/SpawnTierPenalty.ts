import { SPAWNABLE_TIER_COUNT } from '@/config/gameConfig';

/**
 * Read-only view of an active spawn penalty, for HUDs and snapshots (Task 2.19).
 * `floor` is the lowest tier the dispenser may hand out from now on and
 * `remainingCount` is how many new balls the floor still applies to.
 */
export interface SpawnPenaltyHudState {
  readonly floor: number;
  readonly remainingCount: number;
}

/**
 * Risk-card penalty state for `spawn_larger_balls` (Task 2.16): raises the
 * floor of the dispenser tier for the next N *new* balls, so an accepted risk
 * presses on the board instead of only paying out a bigger multiplier.
 *
 * The object is pure state — `Game` owns it, feeds every freshly rolled tier
 * through `apply` and resets it with the run. Nested raises keep the strongest
 * promise instead of stacking: the floor is the maximum of the floors and the
 * charge count is the maximum of the counts.
 */
export class SpawnTierPenalty {
  private floorTier = 0;
  private remaining = 0;

  constructor(private readonly spawnableTierCount: number = SPAWNABLE_TIER_COUNT) {
    if (!Number.isInteger(spawnableTierCount) || spawnableTierCount < 1) {
      throw new RangeError(
        `SpawnTierPenalty: spawnableTierCount must be >= 1, got ${spawnableTierCount}`,
      );
    }
  }

  /** Lowest tier currently guaranteed for new balls; 0 when no penalty is active. */
  get floor(): number {
    return this.remaining > 0 ? this.floorTier : 0;
  }

  /** How many new balls the floor still applies to. */
  get remainingCount(): number {
    return this.remaining;
  }

  get isActive(): boolean {
    return this.remaining > 0;
  }

  /**
   * Raises the spawn floor to at least `minTier` for the next `count` new
   * balls. Only tiers the dispenser can actually spawn (0 .. spawnableTierCount
   * - 1) are accepted; anything else is a programming error.
   */
  raise(minTier: number, count: number): void {
    if (!Number.isInteger(minTier) || minTier < 0 || minTier > this.spawnableTierCount - 1) {
      throw new RangeError(`SpawnTierPenalty.raise: minTier out of range: ${minTier}`);
    }
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError(
        `SpawnTierPenalty.raise: count must be a positive integer, got ${count}`,
      );
    }
    if (!this.isActive) {
      this.floorTier = minTier;
      this.remaining = count;
      return;
    }
    this.floorTier = Math.max(this.floorTier, minTier);
    this.remaining = Math.max(this.remaining, count);
  }

  /**
   * Applies the floor to a freshly rolled dispenser tier and consumes one
   * charge. Without an active penalty the tier is returned untouched and
   * nothing is consumed.
   */
  apply(tier: number): number {
    if (!Number.isInteger(tier) || tier < 0) {
      throw new RangeError(`SpawnTierPenalty.apply: invalid tier ${tier}`);
    }
    if (!this.isActive) {
      return tier;
    }
    this.remaining -= 1;
    const floored = Math.max(tier, this.floorTier);
    if (this.remaining === 0) {
      this.floorTier = 0;
    }
    return floored;
  }

  /** Clears the penalty, e.g. on run reset. */
  reset(): void {
    this.floorTier = 0;
    this.remaining = 0;
  }
}
