import { describe, expect, it } from 'vitest';
import { ROUNDS } from '@/config/gameConfig';
import { BasicRoundSystem } from '@/systems/BasicRoundSystem';

describe('BasicRoundSystem', () => {
  it('starts at round 1 with the configured target and drop budget', () => {
    const rounds = new BasicRoundSystem();
    expect(rounds.currentRound()).toEqual({
      index: 1,
      targetScore: ROUNDS.firstTargetScore,
      dropBudget: ROUNDS.firstDropBudget,
    });
    expect(rounds.isRoundCleared()).toBe(false);
    expect(rounds.isDropBudgetExhausted()).toBe(false);
  });

  it('raises the target and the drop budget every round', () => {
    const rounds = new BasicRoundSystem();
    rounds.advance();
    expect(rounds.currentRound()).toEqual({
      index: 2,
      targetScore: ROUNDS.firstTargetScore + ROUNDS.targetScoreStep,
      dropBudget: ROUNDS.firstDropBudget + ROUNDS.dropBudgetStep,
    });
    rounds.advance();
    expect(rounds.currentRound().targetScore).toBe(
      ROUNDS.firstTargetScore + 2 * ROUNDS.targetScoreStep,
    );
  });

  it('clears when the points earned inside the round reach the target', () => {
    const rounds = new BasicRoundSystem();
    rounds.onScoreChanged(ROUNDS.firstTargetScore - 1);
    expect(rounds.isRoundCleared()).toBe(false);
    rounds.onScoreChanged(ROUNDS.firstTargetScore);
    expect(rounds.isRoundCleared()).toBe(true);
  });

  it('measures progress from the start of the round, not the run', () => {
    const rounds = new BasicRoundSystem();
    // A huge opening round would otherwise insta-clear every following round.
    rounds.onScoreChanged(ROUNDS.firstTargetScore * 10);
    expect(rounds.isRoundCleared()).toBe(true);
    rounds.advance();
    expect(rounds.isRoundCleared()).toBe(false);
    rounds.onScoreChanged(
      ROUNDS.firstTargetScore * 10 + ROUNDS.firstTargetScore + ROUNDS.targetScoreStep - 1,
    );
    expect(rounds.isRoundCleared()).toBe(false);
  });

  it('reopens the round when a score loss drops it below the target again', () => {
    const rounds = new BasicRoundSystem();
    rounds.onScoreChanged(ROUNDS.firstTargetScore);
    expect(rounds.isRoundCleared()).toBe(true);
    rounds.onScoreChanged(ROUNDS.firstTargetScore - 10);
    expect(rounds.isRoundCleared()).toBe(false);
  });

  it('counts drops toward the budget and resets the count on advance', () => {
    const rounds = new BasicRoundSystem();
    for (let i = 0; i < ROUNDS.firstDropBudget - 1; i += 1) {
      rounds.onDrop();
    }
    expect(rounds.isDropBudgetExhausted()).toBe(false);
    rounds.onDrop();
    expect(rounds.isDropBudgetExhausted()).toBe(true);
    rounds.advance();
    expect(rounds.isDropBudgetExhausted()).toBe(false);
  });

  it('resets to round 1 with nothing banked', () => {
    const rounds = new BasicRoundSystem();
    rounds.onScoreChanged(1000);
    rounds.onDrop();
    rounds.onDrop();
    rounds.advance();
    rounds.reset();
    expect(rounds.currentRound().index).toBe(1);
    expect(rounds.isRoundCleared()).toBe(false);
    expect(rounds.isDropBudgetExhausted()).toBe(false);
    rounds.onScoreChanged(ROUNDS.firstTargetScore - 1);
    expect(rounds.isRoundCleared()).toBe(false);
  });
});
