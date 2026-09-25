import { describe, expect, it } from 'vitest';
import { composeRoundSnapshot } from '@/app/composeRoundSnapshot';
import type { GameSnapshot } from '@/core/Game';
import type { RoundHudState } from '@/core/interfaces/IRoundSystem';

function baseSnapshot(): GameSnapshot {
  return {
    state: 'aiming',
    score: 0,
    best: 0,
    balls: [],
    held: null,
    nextTier: 0,
    dangerLineY: 120,
    nearMissIntensity: 0,
    timeScale: 1,
    pendingCards: [],
    seed: 1,
    chainIndex: 0,
    nextSpecial: null,
  };
}

function roundState(): RoundHudState {
  return {
    index: 2,
    targetScore: 250,
    scoreProgress: 90,
    dropsUsed: 4,
    dropBudget: 18,
  };
}

describe('composeRoundSnapshot', () => {
  it('adds the round state to the snapshot when one is available', () => {
    const base = baseSnapshot();
    const round = roundState();

    const composed = composeRoundSnapshot(base, round);

    expect(composed.round).toEqual(round);
    // Everything else passes through untouched.
    expect(composed.state).toBe(base.state);
    expect(composed.score).toBe(base.score);
    expect(composed.nextTier).toBe(base.nextTier);
    expect(composed.pendingCards).toBe(base.pendingCards);
  });

  it('omits the round field entirely when the round state is null', () => {
    const composed = composeRoundSnapshot(baseSnapshot(), null);

    expect('round' in composed).toBe(false);
    expect(composed.round).toBeUndefined();
  });

  it('drops a stale round field when the round state becomes null', () => {
    const withRound = { ...baseSnapshot(), round: roundState() } as GameSnapshot;

    const composed = composeRoundSnapshot(withRound, null);

    expect('round' in composed).toBe(false);
  });

  it('never mutates the original snapshot', () => {
    const base = baseSnapshot();
    const before = JSON.stringify(base);

    composeRoundSnapshot(base, roundState());
    composeRoundSnapshot(base, null);

    expect(JSON.stringify(base)).toBe(before);
    expect('round' in base).toBe(false);
  });

  it('keeps the composed object free of shared round references with the input', () => {
    const base = baseSnapshot();
    const round = roundState();

    const composed = composeRoundSnapshot(base, round);

    expect(composed).not.toBe(base);
    expect(base.round).toBeUndefined();
  });
});
