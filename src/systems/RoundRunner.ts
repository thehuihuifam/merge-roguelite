import type { Game } from '@/core/Game';
import type { MergeCard } from '@/core/interfaces/IMergeCard';
import type { IRoundSystem, RoundDefinition, RoundHudState } from '@/core/interfaces/IRoundSystem';

/**
 * Bridges an `IRoundSystem` to a running `Game` through the event bus (Task
 * 2.2): counts drops and score, and advances rounds — with a reward choice
 * when the target is met, without it when the drop budget runs out first.
 *
 * Since Task 2.13 a clear opens the slow-motion card choice
 * (`Game.openRewardChoice`) with the hand from `choiceFor` instead of
 * banking a flat bonus. The round advances at once, so the picked reward
 * counts as income of the new round. While a choice is open further grants
 * wait; when the board is too busy for a choice (a merge choice owns it)
 * the deterministic head of the hand is applied immediately.
 */
export class RoundRunner {
  private readonly offs: (() => void)[] = [];
  private granting = false;
  private choosing = false;

  constructor(
    private readonly game: Game,
    private readonly rounds: IRoundSystem,
    private readonly choiceFor: (round: RoundDefinition) => MergeCard[],
  ) {
    this.offs.push(
      game.events.on('run:started', (): void => {
        this.rounds.reset();
        this.choosing = false;
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
    this.offs.push(
      game.events.on('time:slowMotionEnd', (): void => {
        this.choosing = false;
        // A round may have cleared while a choice owned the board.
        this.grantIfCleared();
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
    this.grantIfCleared();
  }

  private grantIfCleared(): void {
    if (this.granting || this.choosing || !this.rounds.isRoundCleared()) {
      return;
    }
    const round = this.rounds.currentRound();
    const hand = this.choiceFor(round);
    const head = hand[0];
    if (head === undefined) {
      // No reward configured: the round still completes, without a bonus.
      this.rounds.advance();
      return;
    }
    if (this.game.openRewardChoice(hand)) {
      this.choosing = true;
      this.rounds.advance();
      return;
    }
    // Guard first: applying the reward card emits another score:changed event.
    this.granting = true;
    this.game.applyRewardCard(head);
    this.granting = false;
    this.rounds.advance();
  }
}
