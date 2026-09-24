import { describe, expect, it } from 'vitest';
import { CHAIN_MULTIPLIER_STEP, MAX_TIER_MERGE_BONUS } from '@/config/gameConfig';
import { ScoreCalculator, chainMultiplierFor } from '@/core/score/ScoreCalculator';
import { ScoreState } from '@/core/score/ScoreState';
import type { IScoreModifier } from '@/core/interfaces/IScoreModifier';

describe('ScoreCalculator', () => {
  it('awards the value of the resulting ball for a first merge', () => {
    const calc = new ScoreCalculator();
    const result = calc.calculate({ resultTier: 1, chainIndex: 0, currentScore: 0 });
    expect(result.base).toBe(4);
    expect(result.chainMultiplier).toBe(1);
    expect(result.total).toBe(4);
  });

  it('scales with chain index', () => {
    const calc = new ScoreCalculator();
    const result = calc.calculate({ resultTier: 2, chainIndex: 2, currentScore: 0 });
    expect(chainMultiplierFor(2)).toBe(1 + 2 * CHAIN_MULTIPLIER_STEP);
    expect(result.total).toBe(Math.round(8 * (1 + 2 * CHAIN_MULTIPLIER_STEP)));
  });

  it('pays the max-tier bonus when the result tier is null', () => {
    const calc = new ScoreCalculator();
    expect(calc.calculate({ resultTier: null, chainIndex: 0, currentScore: 0 }).total).toBe(
      MAX_TIER_MERGE_BONUS,
    );
  });

  it('applies and removes modifiers in order', () => {
    const calc = new ScoreCalculator();
    const double: IScoreModifier = { id: 'x2', modify: (p) => p * 2 };
    const plusTen: IScoreModifier = { id: '+10', modify: (p) => p + 10 };
    const removeDouble = calc.addModifier(double);
    calc.addModifier(plusTen);
    expect(calc.calculate({ resultTier: 0, chainIndex: 0, currentScore: 0 }).total).toBe(14);
    removeDouble();
    expect(calc.modifierCount).toBe(1);
    expect(calc.calculate({ resultTier: 0, chainIndex: 0, currentScore: 0 }).total).toBe(12);
  });

  it('never returns negative totals', () => {
    const calc = new ScoreCalculator();
    calc.addModifier({ id: 'neg', modify: () => -50 });
    expect(calc.calculate({ resultTier: 0, chainIndex: 0, currentScore: 0 }).total).toBe(0);
  });
});

describe('ScoreState', () => {
  it('tracks run score and session best', () => {
    const state = new ScoreState(10);
    state.add(5);
    expect(state.score).toBe(5);
    expect(state.best).toBe(10);
    state.add(20);
    expect(state.best).toBe(25);
    state.resetRun();
    expect(state.score).toBe(0);
    expect(state.best).toBe(25);
  });

  it('rejects invalid points', () => {
    const state = new ScoreState();
    expect(() => state.add(-1)).toThrow(RangeError);
    expect(() => state.add(Number.NaN)).toThrow(RangeError);
  });
});
