import { describe, expect, it } from 'vitest';
import { SPAWNABLE_TIER_COUNT } from '@/config/gameConfig';
import { SpawnTierPenalty } from '@/core/ball/SpawnTierPenalty';

describe('SpawnTierPenalty', () => {
  it('leaves rolls untouched while no penalty is active', () => {
    const penalty = new SpawnTierPenalty();

    expect(penalty.isActive).toBe(false);
    expect(penalty.floor).toBe(0);
    expect(penalty.remainingCount).toBe(0);
    expect(penalty.apply(1)).toBe(1);
    expect(penalty.remainingCount).toBe(0);
  });

  it('guarantees the floor for exactly N new balls', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(3, 2);

    expect(penalty.isActive).toBe(true);
    expect(penalty.floor).toBe(3);
    expect(penalty.remainingCount).toBe(2);
    expect(penalty.apply(0)).toBe(3);
    expect(penalty.remainingCount).toBe(1);
    expect(penalty.apply(1)).toBe(3);
    expect(penalty.remainingCount).toBe(0);
    expect(penalty.isActive).toBe(false);
    expect(penalty.floor).toBe(0);
    expect(penalty.apply(0)).toBe(0);
  });

  it('keeps naturally larger rolls instead of downgrading them', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(2, 1);

    expect(penalty.apply(4)).toBe(4);
    expect(penalty.isActive).toBe(false);
  });

  it('nests by keeping the highest floor and the longest count', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(3, 2);
    penalty.raise(4, 1);

    expect(penalty.floor).toBe(4);
    expect(penalty.remainingCount).toBe(2);
    expect(penalty.apply(0)).toBe(4);
    expect(penalty.apply(3)).toBe(4);
    expect(penalty.isActive).toBe(false);
  });

  it('does not shorten an existing penalty when a weaker one is applied', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(4, 1);
    penalty.raise(2, 3);

    expect(penalty.floor).toBe(4);
    expect(penalty.remainingCount).toBe(3);
    expect(penalty.apply(0)).toBe(4);
    expect(penalty.apply(0)).toBe(4);
    expect(penalty.apply(0)).toBe(4);
    expect(penalty.isActive).toBe(false);
  });

  it('clears every charge and the floor on reset', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(3, 3);
    penalty.apply(0);

    penalty.reset();

    expect(penalty.isActive).toBe(false);
    expect(penalty.floor).toBe(0);
    expect(penalty.remainingCount).toBe(0);
    expect(penalty.apply(0)).toBe(0);
  });

  it('accepts only spawnable tiers as a floor', () => {
    const penalty = new SpawnTierPenalty();
    const maxSpawnable = SPAWNABLE_TIER_COUNT - 1;
    penalty.raise(maxSpawnable, 1);

    expect(penalty.apply(0)).toBe(maxSpawnable);
    expect(() => penalty.raise(-1, 1)).toThrow(RangeError);
    expect(() => penalty.raise(SPAWNABLE_TIER_COUNT, 1)).toThrow(RangeError);
    expect(() => penalty.raise(1.5, 1)).toThrow(RangeError);
    expect(() => penalty.raise(Number.NaN, 1)).toThrow(RangeError);
  });

  it('rejects invalid counts and tiers', () => {
    const penalty = new SpawnTierPenalty();

    expect(() => penalty.raise(2, 0)).toThrow(RangeError);
    expect(() => penalty.raise(2, -1)).toThrow(RangeError);
    expect(() => penalty.raise(2, 1.5)).toThrow(RangeError);
    expect(() => penalty.apply(-1)).toThrow(RangeError);
    expect(() => penalty.apply(1.5)).toThrow(RangeError);
  });

  it('honours a custom spawnable tier count', () => {
    const penalty = new SpawnTierPenalty(3);
    penalty.raise(2, 1);

    expect(penalty.apply(0)).toBe(2);
    expect(() => penalty.raise(3, 1)).toThrow(RangeError);
    expect(() => new SpawnTierPenalty(0)).toThrow(RangeError);
    expect(() => new SpawnTierPenalty(-2)).toThrow(RangeError);
    expect(() => new SpawnTierPenalty(2.5)).toThrow(RangeError);
  });
});
