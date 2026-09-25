import { MAX_TIER, SPAWNABLE_TIER_COUNT } from '@/config/gameConfig';
import { isValidTier } from '@/core/ball/BallFactory';

/**
 * Pure state for the `spawn_larger_balls` risk penalty (Task 2.16): dispenser
 * balls are forced up to a minimum tier for the next N new issuances.
 *
 * The host (`Game`, Task 2.17) applies it to every newly issued ball; the
 * card layer only raises it through the `raiseSpawnTierFloor` context
 * callback. Nesting takes the maximum of the floors and of the remaining
 * counts, so an overlapping stronger penalty never shortens a weaker one.
 * Issuance order and bomb rolls are untouched — only the tier is lifted.
 */
export class SpawnTierPenalty {
  private readonly spawnableTierCount: number;
  private floorTier = 0;
  private remainingCount = 0;

  constructor(spawnableTierCount: number = SPAWNABLE_TIER_COUNT) {
    if (
      !Number.isInteger(spawnableTierCount) ||
      spawnableTierCount < 1 ||
      spawnableTierCount > MAX_TIER + 1
    ) {
      throw new RangeError(
        `SpawnTierPenalty: spawnableTierCount out of range: ${spawnableTierCount}`,
      );
    }
    this.spawnableTierCount = spawnableTierCount;
  }

  /** Highest floor currently demanded (0 = none). */
  get minTier(): number {
    return this.floorTier;
  }

  /** Issuances left before the penalty expires. */
  get remainingIssuances(): number {
    return this.remainingCount;
  }

  get active(): boolean {
    return this.remainingCount > 0;
  }

  /**
   * Raises the spawn floor to `minTier` for the next `count` new dispenser
   * balls. Nesting keeps the maximum floor and the maximum remaining count.
   * `minTier` must stay inside the spawnable tier range — a floor the
   * dispenser can never roll would only corrupt the preview contract.
   */
  raise(minTier: number, count: number): void {
    if (!isValidTier(minTier) || minTier >= this.spawnableTierCount) {
      throw new RangeError(
        `SpawnTierPenalty.raise: minTier must be a spawnable tier (0..${this.spawnableTierCount - 1}), got ${minTier}`,
      );
    }
    if (!Number.isInteger(count) || count <= 0) {
      throw new RangeError(`SpawnTierPenalty.raise: count must be a positive integer, got ${count}`);
    }
    this.floorTier = Math.max(this.floorTier, minTier);
    this.remainingCount = Math.max(this.remainingCount, count);
  }

  /**
   * Consumes one issuance and returns the tier the dispenser must use: the
   * incoming tier lifted to the floor while the penalty is active, the tier
   * itself once it has expired. Invalid tiers are rejected before any state
   * changes.
   */
  apply(tier: number): number {
    if (!isValidTier(tier)) {
      throw new RangeError(`SpawnTierPenalty.apply: tier must be 0..${MAX_TIER}, got ${tier}`);
    }
    if (!this.active) {
      return tier;
    }
    this.remainingCount -= 1;
    const raised = Math.max(tier, this.floorTier);
    if (this.remainingCount === 0) {
      this.floorTier = 0;
    }
    return raised;
  }

  /** Releases the penalty entirely (run restart). */
  reset(): void {
    this.floorTier = 0;
    this.remainingCount = 0;
  }
}
