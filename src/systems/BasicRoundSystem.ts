import { ROUNDS } from '@/config/gameConfig';
import type { IRoundSystem, RoundDefinition, RoundHudState } from '@/core/interfaces/IRoundSystem';

/**
 * Score-target rounds (Task 2.2). Each round must earn `targetScore` points
 * within its `dropBudget` drops; "within the round" means the points banked
 * since the round began. Clearing the target earns the round-clear reward card
 * (wired by `src/systems/RoundRunner.ts`), while burning the whole drop budget
 * first fails the round and moves on with no reward. Tuning lives in `ROUNDS`.
 */
export class BasicRoundSystem implements IRoundSystem {
  private index = 1;
  private scoreAtRoundStart = 0;
  private currentScore = 0;
  private dropsUsed = 0;

  currentRound(): RoundDefinition {
    const steps = this.index - 1;
    return {
      index: this.index,
      targetScore: ROUNDS.firstTargetScore + ROUNDS.targetScoreStep * steps,
      dropBudget: ROUNDS.firstDropBudget + ROUNDS.dropBudgetStep * steps,
    };
  }

  onDrop(): void {
    this.dropsUsed += 1;
  }

  /** Tracks the run score. The round progresses on the delta since it began. */
  onScoreChanged(score: number): void {
    this.currentScore = score;
  }

  isRoundCleared(): boolean {
    return this.currentScore - this.scoreAtRoundStart >= this.currentRound().targetScore;
  }

  isDropBudgetExhausted(): boolean {
    return this.dropsUsed >= this.currentRound().dropBudget;
  }

  getHudState(): RoundHudState {
    const round = this.currentRound();
    return {
      index: round.index,
      targetScore: round.targetScore,
      scoreProgress: Math.max(0, this.currentScore - this.scoreAtRoundStart),
      dropsUsed: this.dropsUsed,
      dropBudget: round.dropBudget,
    };
  }

  advance(): RoundDefinition {
    this.index += 1;
    this.scoreAtRoundStart = this.currentScore;
    this.dropsUsed = 0;
    return this.currentRound();
  }

  reset(): void {
    this.index = 1;
    this.scoreAtRoundStart = 0;
    this.currentScore = 0;
    this.dropsUsed = 0;
  }
}
