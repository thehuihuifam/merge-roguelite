import { MAX_TIER } from '@/config/gameConfig';
import type { Ball } from '@/core/types';

/** Two balls merge when they share a tier. Special balls can override this via ISpecialBallBehavior. */
export function canMerge(a: Ball, b: Ball): boolean {
  return a.id !== b.id && a.tier === b.tier;
}

/** Tier produced by merging two balls of `tier`, or null when they are max tier and vanish. */
export function resultTierFor(tier: number): number | null {
  if (tier >= MAX_TIER) {
    return null;
  }
  return tier + 1;
}
