/** Mutable score for the current run plus the best score seen this session. */
export class ScoreState {
  private currentScore = 0;
  private bestScore: number;

  constructor(initialBest = 0) {
    this.bestScore = Math.max(0, initialBest);
  }

  get score(): number {
    return this.currentScore;
  }

  get best(): number {
    return this.bestScore;
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

  resetRun(): void {
    this.currentScore = 0;
  }
}
