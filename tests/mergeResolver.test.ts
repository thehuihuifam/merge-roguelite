import { describe, expect, it } from 'vitest';
import { MAX_TIER } from '@/config/gameConfig';
import { MergeResolver } from '@/core/merge/MergeResolver';
import type { Ball, CollisionPair } from '@/core/types';

function makeLookup(balls: Ball[]): (id: number) => Ball | undefined {
  const map = new Map(balls.map((b) => [b.id, b]));
  return (id) => map.get(id);
}

function ball(id: number, tier: number, x = 0, y = 0): Ball {
  return { id, tier, position: { x, y }, velocity: { x: 0, y: 0 }, spawnedAt: 0 };
}

describe('MergeResolver', () => {
  const resolver = new MergeResolver();

  it('creates a merge at the midpoint of two equal balls', () => {
    const lookup = makeLookup([ball(1, 0, 0, 0), ball(2, 0, 10, 20)]);
    const plans = resolver.resolve([{ a: 1, b: 2 }], lookup);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toEqual({ sourceIds: [1, 2], resultTier: 1, position: { x: 5, y: 10 } });
  });

  it('ignores pairs with different tiers or unknown ids', () => {
    const lookup = makeLookup([ball(1, 0), ball(2, 1)]);
    const pairs: CollisionPair[] = [
      { a: 1, b: 2 },
      { a: 1, b: 99 },
    ];
    expect(resolver.resolve(pairs, lookup)).toHaveLength(0);
  });

  it('uses each ball at most once per pass (three-way pile-up)', () => {
    const lookup = makeLookup([ball(1, 0), ball(2, 0), ball(3, 0)]);
    const pairs: CollisionPair[] = [
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 1, b: 3 },
    ];
    const plans = resolver.resolve(pairs, lookup);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.sourceIds).toEqual([1, 2]);
  });

  it('resolves independent pairs in the same pass', () => {
    const lookup = makeLookup([ball(1, 0), ball(2, 0), ball(3, 3), ball(4, 3)]);
    const plans = resolver.resolve(
      [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ],
      lookup,
    );
    expect(plans.map((p) => p.resultTier)).toEqual([1, 4]);
  });

  it('marks max-tier merges with a null result tier', () => {
    const lookup = makeLookup([ball(1, MAX_TIER), ball(2, MAX_TIER)]);
    const plans = resolver.resolve([{ a: 1, b: 2 }], lookup);
    expect(plans[0]?.resultTier).toBeNull();
  });
});
