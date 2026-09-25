import { describe, expect, it } from 'vitest';
import { BALL_TIERS, MAX_TIER, SPAWNABLE_TIER_COUNT } from '@/config/gameConfig';
import { BallFactory, getTierSpec, isValidTier } from '@/core/ball/BallFactory';
import { SeededRandom } from '@/core/rng/SeededRandom';

describe('tier specs', () => {
  it('are strictly increasing in value and radius', () => {
    for (let i = 1; i < BALL_TIERS.length; i += 1) {
      const prev = BALL_TIERS[i - 1];
      const curr = BALL_TIERS[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      if (prev === undefined || curr === undefined) {
        continue;
      }
      expect(curr.tier).toBe(prev.tier + 1);
      expect(curr.value).toBe(prev.value * 2);
      expect(curr.radius).toBeGreaterThan(prev.radius);
    }
  });

  it('getTierSpec throws for unknown tiers', () => {
    expect(() => getTierSpec(-1)).toThrow(RangeError);
    expect(() => getTierSpec(MAX_TIER + 1)).toThrow(RangeError);
    expect(isValidTier(MAX_TIER)).toBe(true);
    expect(isValidTier(1.5)).toBe(false);
  });
});

describe('BallFactory', () => {
  it('assigns unique incrementing ids', () => {
    const factory = new BallFactory(new SeededRandom(1));
    const a = factory.create(0, { x: 10, y: 20 }, 0);
    const b = factory.create(0, { x: 10, y: 20 }, 0);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(a.position).toEqual({ x: 10, y: 20 });
    expect(a.velocity).toEqual({ x: 0, y: 0 });
  });

  it('copies the position instead of aliasing it', () => {
    const factory = new BallFactory(new SeededRandom(1));
    const pos = { x: 1, y: 2 };
    const ball = factory.create(0, pos, 0);
    expect(ball.position).not.toBe(pos);
  });

  it('only rolls spawnable tiers and is deterministic per seed', () => {
    const a = new BallFactory(new SeededRandom(42));
    const b = new BallFactory(new SeededRandom(42));
    const rolls: number[] = [];
    for (let i = 0; i < 500; i += 1) {
      const tier = a.rollSpawnTier();
      expect(tier).toBe(b.rollSpawnTier());
      expect(tier).toBeGreaterThanOrEqual(0);
      expect(tier).toBeLessThan(SPAWNABLE_TIER_COUNT);
      rolls.push(tier);
    }
    const countOf = (tier: number): number => rolls.filter((t) => t === tier).length;
    expect(countOf(0)).toBeGreaterThan(countOf(SPAWNABLE_TIER_COUNT - 1));
  });

  it('rejects invalid tiers and bad spawnable counts', () => {
    const factory = new BallFactory(new SeededRandom(1));
    expect(() => factory.create(99, { x: 0, y: 0 }, 0)).toThrow(RangeError);
    expect(() => new BallFactory(new SeededRandom(1), 0)).toThrow(RangeError);
  });
});

describe('BallFactory special balls', () => {
  it('rolls only bombs at spawn chance 1 and never at 0', () => {
    const always = new BallFactory(new SeededRandom(3), SPAWNABLE_TIER_COUNT, 1);
    const never = new BallFactory(new SeededRandom(3), SPAWNABLE_TIER_COUNT, 0);
    for (let i = 0; i < 20; i += 1) {
      expect(always.rollSpawnSpecial()).toBe('bomb');
      expect(never.rollSpawnSpecial()).toBeUndefined();
    }
  });

  it('rejects out-of-range special spawn chances', () => {
    expect(() => new BallFactory(new SeededRandom(1), SPAWNABLE_TIER_COUNT, -0.1)).toThrow(
      RangeError,
    );
    expect(() => new BallFactory(new SeededRandom(1), SPAWNABLE_TIER_COUNT, 1.1)).toThrow(
      RangeError,
    );
  });

  it('tags created balls with their special kind', () => {
    const factory = new BallFactory(new SeededRandom(3), SPAWNABLE_TIER_COUNT, 1);
    const bomb = factory.create(0, { x: 1, y: 2 }, 0, 'bomb');
    expect(bomb.special).toBe('bomb');
    const plain = factory.create(0, { x: 1, y: 2 }, 0);
    expect(plain.special).toBeUndefined();
  });
});
