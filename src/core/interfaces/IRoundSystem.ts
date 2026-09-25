export interface RoundDefinition {
  readonly index: number;
  /** Points to earn while this round is current (earned since the round began). */
  readonly targetScore: number;
  /** Drops allotted to this round before it is considered failed. */
  readonly dropBudget: number;
}

/** Roguelite structure: runs are split into rounds with score targets and rewards. */
export interface IRoundSystem {
  currentRound(): RoundDefinition;
  onDrop(): void;
  onScoreChanged(score: number): void;
  /** True when the target is met and the round may advance. */
  isRoundCleared(): boolean;
  /** True once the round's drop budget is used up (field added by Task 2.2). */
  isDropBudgetExhausted(): boolean;
  advance(): RoundDefinition;
  reset(): void;
}
