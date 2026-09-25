import { describe, expect, it } from 'vitest';
import { MAX_TIER, SPAWNABLE_TIER_COUNT } from '@/config/gameConfig';
import { SpawnTierPenalty } from '@/core/ball/SpawnTierPenalty';

describe('SpawnTierPenalty', () => {
  it('is inactive by default and leaves tiers untouched', () => {
    const penalty = new SpawnTierPenalty();

    expect(penalty.active).toBe(false);
    expect(penalty.minTier).toBe(0);
    expect(penalty.remainingIssuances).toBe(0);
    expect(penalty.apply(0)).toBe(0);
    expect(penalty.apply(4)).toBe(4);
    expect(penalty.remainingIssuances).toBe(0);
  });

  it('lifts new issuances to the floor while active', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(3, 2);

    expect(penalty.active).toBe(true);
    expect(penalty.minTier).toBe(3);
    expect(penalty.apply(0)).toBe(3);
    expect(penalty.apply(2)).toBe(3);
  });

  it('expires after exactly N consumptions and restores normal rolls', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(2, 3);

    expect(penalty.apply(0)).toBe(2);
    expect(penalty.apply(1)).toBe(2);
    expect(penalty.apply(4)).toBe(4);
    expect(penalty.active).toBe(false);
    expect(penalty.minTier).toBe(0);
    expect(penalty.apply(0)).toBe(0);
  });

  it('keeps tiers above the floor unchanged without wasting the penalty', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(3, 1);

    expect(penalty.apply(4)).toBe(4);
    expect(penalty.active).toBe(false);
    expect(penalty.apply(1)).toBe(1);
  });

  it('nests raises by taking the maximum floor and the maximum remaining count', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(3, 2);
    penalty.raise(1, 5);

    expect(penalty.minTier).toBe(3);
    expect(penalty.remainingIssuances).toBe(5);

    penalty.raise(4, 1);
    expect(penalty.minTier).toBe(4);
    expect(penalty.remainingIssuances).toBe(5);
  });

  it('a nested longer raise extends the combined floor across every charge', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(3, 2);
    penalty.raise(1, 4);

    // Nesting keeps the max floor (3) and the max count (4): the combined
    // state is a single floor-3 penalty with 4 issuances left.
    for (let i = 0; i < 4; i += 1) {
      expect(penalty.apply(0)).toBe(3);
    }
    expect(penalty.active).toBe(false);
    expect(penalty.apply(2)).toBe(2);
  });

  it('reset releases the penalty entirely', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(4, 5);
    penalty.reset();

    expect(penalty.active).toBe(false);
    expect(penalty.minTier).toBe(0);
    expect(penalty.remainingIssuances).toBe(0);
    expect(penalty.apply(0)).toBe(0);
  });

  it('rejects floors outside the spawnable tier range', () => {
    const penalty = new SpawnTierPenalty();

    expect((): void => penalty.raise(-1, 2)).toThrow(RangeError);
    expect((): void => penalty.raise(1.5, 2)).toThrow(RangeError);
    expect((): void => penalty.raise(SPAWNABLE_TIER_COUNT, 2)).toThrow(RangeError);
    expect((): void => penalty.raise(MAX_TIER, 2)).toThrow(RangeError);
    expect((): void => penalty.raise(Number.NaN, 2)).toThrow(RangeError);
    expect(penalty.active).toBe(false);
  });

  it('rejects invalid counts', () => {
    const penalty = new SpawnTierPenalty();

    expect((): void => penalty.raise(2, 0)).toThrow(RangeError);
    expect((): void => penalty.raise(2, -3)).toThrow(RangeError);
    expect((): void => penalty.raise(2, 2.5)).toThrow(RangeError);
    expect((): void => penalty.raise(2, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(penalty.active).toBe(false);
  });

  it('rejects invalid tiers in apply without consuming a charge', () => {
    const penalty = new SpawnTierPenalty();
    penalty.raise(2, 2);

    expect((): number => penalty.apply(-1)).toThrow(RangeError);
    expect((): number => penalty.apply(1.5)).toThrow(RangeError);
    expect((): number => penalty.apply(MAX_TIER + 1)).toThrow(RangeError);
    expect(penalty.remainingIssuances).toBe(2);
  });

  it('honours a custom spawnable tier count', () => {
    const penalty = new SpawnTierPenalty(3);
    penalty.raise(2, 1);
    expect(penalty.apply(0)).toBe(2);

    expect((): void => penalty.raise(3, 1)).toThrow(RangeError);
    expect((): void => {
      new SpawnTierPenalty(0);
    }).toThrow(RangeError);
    expect((): void => {
      new SpawnTierPenalty(2.5);
    }).toThrow(RangeError);
  });
});
