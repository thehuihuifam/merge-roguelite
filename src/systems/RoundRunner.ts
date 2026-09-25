import type { Game } from '@/core/Game';
import type { MergeCard } from '@/core/interfaces/IMergeCard';
import type { IRoundSystem, RoundDefinition, RoundHudState } from '@/core/interfaces/IRoundSystem';

/**
 * Bridges an `IRoundSystem` to a running `Game` through the event bus (Task
 * 2.2): counts drops and score, grants the round-clear reward card via
 * `Game.applyRewardCard`, and advances rounds — with the reward when the
 * target is met, without it when the drop budget runs out first.
 */
export class RoundRunner {
  private readonly offs: (() => void)[] = [];
  private granting = false;

  constructor(
    private readonly game: Game,
    private readonly rounds: IRoundSystem,
    private readonly rewardFor: (round: RoundDefinition) => MergeCard,
  ) {
    this.offs.push(
      game.events.on('run:started', (): void => {
        this.rounds.reset();
      }),
    );
    this.offs.push(
      game.events.on('ball:dropped', (): void => {
        this.handleDrop();
      }),
    );
    this.offs.push(
      game.events.on('score:changed', ({ score }): void => {
        this.handleScore(score);
      }),
    );
  }

  /**
   * HUD snapshot of the current round, or null when the round system does not
   * expose one. The app layer merges this into the rendered `GameSnapshot`.
   */
  getHudState(): RoundHudState | null {
    return this.rounds.getHudState?.() ?? null;
  }

  /** Detaches every event listener. */
  dispose(): void {
    for (const off of this.offs) {
      off();
    }
    this.offs.length = 0;
  }

  private handleDrop(): void {
    this.rounds.onDrop();
    if (!this.rounds.isRoundCleared() && this.rounds.isDropBudgetExhausted()) {
      this.rounds.advance();
    }
  }

  private handleScore(score: number): void {
    this.rounds.onScoreChanged(score);
    if (this.granting || !this.rounds.isRoundCleared()) {
      return;
    }
    const round = this.rounds.currentRound();
    // Guard first: applying the reward card emits another score:changed event.
    this.granting = true;
    this.game.applyRewardCard(this.rewardFor(round));
    this.granting = false;
    this.rounds.advance();
  }
}
