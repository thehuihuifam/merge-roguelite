export interface RoundDefinition {
  readonly index: number;
  readonly targetScore: number;
  readonly dropBudget: number;
}

/** Roguelite structure: runs are split into rounds with score targets and rewards. */
export interface IRoundSystem {
  currentRound(): RoundDefinition;
  onDrop(): void;
  onScoreChanged(score: number): void;
  /** True when the target is met and the round may advance. */
  isRoundCleared(): boolean;
  advance(): RoundDefinition;
  reset(): void;
}
