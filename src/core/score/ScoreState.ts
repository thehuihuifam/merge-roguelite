/** Mutable score for the current run plus the best score seen this session. */
export class ScoreState {
  private currentScore = 0;
  private bestScore: number;
  /** Best held when the current run started — the NEW BEST comparison base. */
  private bestAtRunStart: number;

  constructor(initialBest = 0) {
    this.bestScore = Math.max(0, initialBest);
    this.bestAtRunStart = this.bestScore;
  }

  get score(): number {
    return this.currentScore;
  }

  get best(): number {
    return this.bestScore;
  }

  /**
   * True while the run's current score strictly beats the best held at run
   * start (session B game-over screen: NEW BEST badge).
   */
  get isNewBest(): boolean {
    return this.currentScore > this.bestAtRunStart;
  }

  add(points: number): number {
    if (!Number.isFinite(points) || points < 0) {
      throw new RangeError(`Cannot add invalid points: ${points}`);
    }
    this.currentScore += points;
    if (this.currentScore > this.bestScore) {
      this.bestScore = this.currentScore;
    }
    return this.currentScore;
  }

  /** Zeroes the run score only — mid-run resets (risk-card score loss). */
  resetScore(): void {
    this.currentScore = 0;
  }

  /** Starts a new run: zeroes the score and re-bases the NEW BEST check. */
  resetRun(): void {
    this.currentScore = 0;
    this.bestAtRunStart = this.bestScore;
  }
}
