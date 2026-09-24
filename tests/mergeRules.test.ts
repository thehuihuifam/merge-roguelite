import { describe, expect, it } from 'vitest';
import { MAX_TIER } from '@/config/gameConfig';
import { canMerge, resultTierFor } from '@/core/merge/MergeRules';
import type { Ball } from '@/core/types';

function ball(id: number, tier: number): Ball {
  return { id, tier, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, spawnedAt: 0 };
}

describe('MergeRules', () => {
  it('merges only equal tiers of distinct balls', () => {
    expect(canMerge(ball(1, 2), ball(2, 2))).toBe(true);
    expect(canMerge(ball(1, 2), ball(2, 3))).toBe(false);
    expect(canMerge(ball(1, 2), ball(1, 2))).toBe(false);
  });

  it('advances one tier, and max tier merges annihilate', () => {
    expect(resultTierFor(0)).toBe(1);
    expect(resultTierFor(MAX_TIER - 1)).toBe(MAX_TIER);
    expect(resultTierFor(MAX_TIER)).toBeNull();
  });
});
