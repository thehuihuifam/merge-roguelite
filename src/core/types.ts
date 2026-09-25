import type { SpecialBallKind } from '@/core/interfaces/ISpecialBall';

export type BallId = number;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface BallTierSpec {
  readonly tier: number;
  readonly value: number;
  readonly radius: number;
  readonly color: string;
}

export interface Ball {
  readonly id: BallId;
  readonly tier: number;
  position: Vec2;
  velocity: Vec2;
  /** Wall-clock (game time) at which the ball entered the world, in ms. */
  readonly spawnedAt: number;
  /** Special kind (bomb, ...); absent for ordinary balls. */
  readonly special?: SpecialBallKind;
}

export interface CollisionPair {
  readonly a: BallId;
  readonly b: BallId;
}

export interface MergePlan {
  readonly sourceIds: readonly [BallId, BallId];
  /** Tier of the resulting ball, or null when two max-tier balls annihilate. */
  readonly resultTier: number | null;
  readonly position: Vec2;
}

export interface MergeEvent extends MergePlan {
  /** 0 for the first merge after a drop, 1 for the next, and so on. */
  readonly chainIndex: number;
  readonly scoreGained: number;
}

export interface NearMissSample {
  /** 0 = at the bottom of the warning zone, 1 = touching the danger line. */
  readonly severity: number;
  readonly ballId: BallId;
  readonly distanceToLine: number;
}
