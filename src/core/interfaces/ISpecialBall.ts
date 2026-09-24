import type { Ball } from '@/core/types';

export type SpecialBallKind = 'bomb' | 'wildcard' | 'freeze' | 'multiplier';

/**
 * Special balls override default merge rules. A behavior returning `null`
 * from canMergeWith defers to the default same-tier rule.
 */
export interface ISpecialBallBehavior {
  readonly kind: SpecialBallKind;
  canMergeWith(self: Ball, other: Ball): boolean | null;
  onSpawn(self: Ball): void;
  onCollide(self: Ball, other: Ball): void;
  onMerged(self: Ball, other: Ball): void;
}

export interface ISpecialBallRegistry {
  register(behavior: ISpecialBallBehavior): void;
  get(kind: SpecialBallKind): ISpecialBallBehavior | undefined;
}
