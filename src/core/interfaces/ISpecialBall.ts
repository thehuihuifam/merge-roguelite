import type { Ball } from '@/core/types';

export type SpecialBallKind = 'bomb' | 'wildcard' | 'freeze' | 'multiplier';

/**
 * Special balls override default merge rules. A behavior returning `null`
 * from canMergeWith defers to the default same-tier rule.
 */
export interface ISpecialBallBehavior {
  readonly kind: SpecialBallKind;
  /**
   * When set, the first collision detonates the ball: the host removes every
   * ball within this radius of it (the contacted ball always goes too).
   * Absent means the special never detonates. Field added by Task 2.2-era
   * bomb work (Task 2.3).
   */
  readonly blastRadius?: number;
  canMergeWith(self: Ball, other: Ball): boolean | null;
  onSpawn(self: Ball): void;
  onCollide(self: Ball, other: Ball): void;
  onMerged(self: Ball, other: Ball): void;
}

export interface ISpecialBallRegistry {
  register(behavior: ISpecialBallBehavior): void;
  get(kind: SpecialBallKind): ISpecialBallBehavior | undefined;
}
