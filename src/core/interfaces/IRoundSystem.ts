export interface RoundDefinition {
  readonly index: number;
  /** Points to earn while this round is current (earned since the round began). */
  readonly targetScore: number;
  /** Drops allotted to this round before it is considered failed. */
  readonly dropBudget: number;
}

/**
 * Read-only view of the current round for the HUD (Task 2.12).
 * `scoreProgress` is the points banked since the round began (>= 0);
 * `dropsUsed` counts the drops spent inside the current round.
 */
export interface RoundHudState {
  readonly index: number;
  readonly targetScore: number;
  readonly scoreProgress: number;
  readonly dropsUsed: number;
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
  /**
   * HUD snapshot of the current round, when the implementation tracks one
   * (field added by Task 2.12). Absent means \"no round display\".
   */
  getHudState?(): RoundHudState;
}
