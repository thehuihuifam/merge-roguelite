import { BALL_TIERS, MAX_TIER, SPAWNABLE_TIER_COUNT, SPECIAL_BALLS } from '@/config/gameConfig';
import type { SpecialBallKind } from '@/core/interfaces/ISpecialBall';
import type { Ball, BallId, BallTierSpec, Vec2 } from '@/core/types';
import type { SeededRandom } from '@/core/rng/SeededRandom';

export function getTierSpec(tier: number): BallTierSpec {
  const spec = BALL_TIERS[tier];
  if (spec === undefined) {
    throw new RangeError(`Unknown ball tier: ${tier}`);
  }
  return spec;
}

export function isValidTier(tier: number): boolean {
  return Number.isInteger(tier) && tier >= 0 && tier <= MAX_TIER;
}

/**
 * Creates Ball domain objects with unique ids and picks which tier the
 * dispenser offers next.
 */
export class BallFactory {
  private nextId: BallId = 1;

  constructor(
    private readonly rng: SeededRandom,
    private readonly spawnableTierCount: number = SPAWNABLE_TIER_COUNT,
    private readonly specialSpawnChance: number = SPECIAL_BALLS.bombSpawnChance,
  ) {
    if (spawnableTierCount < 1 || spawnableTierCount > BALL_TIERS.length) {
      throw new RangeError(`spawnableTierCount out of range: ${spawnableTierCount}`);
    }
    if (specialSpawnChance < 0 || specialSpawnChance > 1) {
      throw new RangeError(`specialSpawnChance out of range: ${specialSpawnChance}`);
    }
  }

  /** Picks the next tier the dispenser offers. Smaller tiers are weighted heavier. */
  rollSpawnTier(): number {
    const weights: number[] = [];
    for (let tier = 0; tier < this.spawnableTierCount; tier += 1) {
      weights.push(this.spawnableTierCount - tier);
    }
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = this.rng.next() * total;
    for (let tier = 0; tier < weights.length; tier += 1) {
      const weight = weights[tier] ?? 0;
      if (roll < weight) {
        return tier;
      }
      roll -= weight;
    }
    return this.spawnableTierCount - 1;
  }

  /**
   * Rolls whether the next dispenser ball is special. Bomb only for now;
   * more kinds land with their own spawn entries later.
   */
  rollSpawnSpecial(): SpecialBallKind | undefined {
    return this.rng.next() < this.specialSpawnChance ? 'bomb' : undefined;
  }

  create(tier: number, position: Vec2, spawnedAt: number, special?: SpecialBallKind): Ball {
    if (!isValidTier(tier)) {
      throw new RangeError(`Cannot create ball with invalid tier ${tier}`);
    }
    const ball: Ball = {
      id: this.nextId,
      tier,
      position: { x: position.x, y: position.y },
      velocity: { x: 0, y: 0 },
      spawnedAt,
      ...(special === undefined ? {} : { special }),
    };
    this.nextId += 1;
    return ball;
  }

  reset(): void {
    this.nextId = 1;
  }
}
